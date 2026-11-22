import { createHash, randomBytes, randomUUID } from "node:crypto";
import { getPool } from "../config/database.js";

const CATEGORIES = {
  "particular": { payment: "private", priority: false, prefix: "P", label: "Particular" },
  "particular-prioridade": { payment: "private", priority: true, prefix: "PP", label: "Particular Prioridade" },
  "convenio": { payment: "insurance", priority: false, prefix: "C", label: "Convênio" },
  "convenio-prioridade": { payment: "insurance", priority: true, prefix: "CP", label: "Convênio Prioridade" },
};
const hash = token => createHash("sha256").update(token).digest("hex");
const limiter = new Map();
function allow(ip) {
  const now = Date.now();
  if (limiter.size > 2000) for (const [key, value] of limiter) if (value.until < now) limiter.delete(key);
  const state = limiter.get(ip);
  if (!state || state.until < now) { limiter.set(ip, { count: 1, until: now + 60000 }); return true; }
  if (state.count >= 12) return false;
  state.count++;
  return true;
}
async function clinic(client) {
  const { rows } = await client.query("SELECT name, website_url, timezone FROM public.clinic_settings WHERE id=1");
  return rows[0] ?? { name: "SICA - FORTALEZA", website_url: null, timezone: "America/Fortaleza" };
}
function localDay(timezone) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
function validUrl(url) { return typeof url === "string" && /^https:\/\//i.test(url); }
export async function clinicPublic(req, res) {
  res.set("Cache-Control","no-store");
  try {
    const settings = await clinic(getPool());
    return res.json({ name: settings.name, websiteUrl: validUrl(settings.website_url) ? settings.website_url : null });
  } catch { return res.status(503).json({ error: "Clínica indisponível" }); }
}
export async function issueKioskTicket(req, res) {
  res.set("Cache-Control","no-store");
  if (!allow(req.ip)) return res.status(429).json({ error: "Muitas solicitações. Aguarde um minuto." });
  const { category, requestId } = req.body ?? {};
  const type = CATEGORIES[category];
  if (!type || typeof requestId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) {
    return res.status(400).json({ error: "Solicitação inválida" });
  }
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const settings = await clinic(client);
    const day = localDay(settings.timezone);
    // A per-request advisory lock makes retries safe even across parallel kiosks.
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [requestId]);
    const prior = await client.query(
      "SELECT j.id, j.started_at, j.tracking_expires_at, e.ticket_code FROM public.kiosk_issuance_requests r JOIN public.patient_journeys j ON j.id=r.journey_id JOIN public.queue_entries e ON e.journey_id=j.id WHERE r.request_id=$1",
      [requestId]
    );
    if (prior.rows.length) {
      await client.query("COMMIT");
      // Tracking capability is intentionally never stored in plaintext. A retry cannot recover it.
      return res.status(409).json({ error: "Senha já emitida. Solicite auxílio na recepção se a impressão falhou." });
    }
    let active = await client.query(
      "SELECT qi.id FROM public.queue_instances qi JOIN public.queue_sessions qs ON qs.id=qi.session_id JOIN public.queue_definitions qd ON qd.id=qs.definition_id WHERE qd.stage_type='reception' AND qd.active=true AND qi.active=true AND qi.professional_id IS NULL AND qs.status='active' AND qs.starts_at <= now() AND qs.ends_at > now() ORDER BY qs.starts_at DESC LIMIT 1 FOR UPDATE OF qi",
    );
    if (!active.rows[0]) {
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", ["kiosk-reception:" + day]);
      active = await client.query(
        "SELECT qi.id FROM public.queue_instances qi JOIN public.queue_sessions qs ON qs.id=qi.session_id JOIN public.queue_definitions qd ON qd.id=qs.definition_id WHERE qd.stage_type='reception' AND qd.active=true AND qi.active=true AND qi.professional_id IS NULL AND qs.status='active' AND qs.starts_at <= now() AND qs.ends_at > now() ORDER BY qs.starts_at DESC LIMIT 1"
      );
      if (!active.rows[0]) {
        const defs = await client.query("SELECT id FROM public.queue_definitions WHERE stage_type='reception' AND queue_mode='shared' AND active=true ORDER BY created_at LIMIT 1");
        if (!defs.rows[0]) {
          await client.query("ROLLBACK");
          return res.status(409).json({ error: "Configure uma fila de recepção antes de emitir senhas." });
        }
        const session = await client.query(
          "INSERT INTO public.queue_sessions(definition_id,starts_at,ends_at,status) VALUES($1,now(),(($2::date + 1)::timestamp AT TIME ZONE $3),'active') RETURNING id",
          [defs.rows[0].id, day, settings.timezone]
        );
        active = await client.query("INSERT INTO public.queue_instances(session_id) VALUES($1) RETURNING id",[session.rows[0].id]);
      }
    }
    const count = await client.query(
      "INSERT INTO public.kiosk_ticket_counters(local_date,category,last_number) VALUES($1,$2,1) ON CONFLICT(local_date,category) DO UPDATE SET last_number=public.kiosk_ticket_counters.last_number+1 RETURNING last_number",
      [day,category]
    );
    const ticketCode = type.prefix + "-" + String(count.rows[0].last_number).padStart(3,"0");
    const token = randomBytes(32).toString("base64url");
    const journeyId = randomUUID();
    const journey = await client.query(
      "INSERT INTO public.patient_journeys(id,tracking_token_hash,tracking_expires_at) VALUES($1,$2,now()+interval '24 hours') RETURNING started_at",
      [journeyId,hash(token)]
    );
    await client.query(
      "INSERT INTO public.queue_entries(journey_id,queue_id,ticket_code,payment_category,legal_priority) VALUES($1,$2,$3,$4,$5)",
      [journeyId,active.rows[0].id,ticketCode,type.payment,type.priority]
    );
    await client.query("INSERT INTO public.kiosk_issuance_requests(request_id,journey_id) VALUES($1,$2)",[requestId,journeyId]);
    await client.query("COMMIT");
    return res.status(201).json({ ticketCode, categoryLabel: type.label, issuedAt: journey.rows[0].started_at, clinicName: settings.name, trackingToken: token });
  } catch(error) {
    await client.query("ROLLBACK").catch(()=>{});
    console.error("Kiosk ticket issue failed", { code: error.code ?? "UNKNOWN" });
    return res.status(503).json({ error: "Não foi possível emitir a senha. Procure a recepção." });
  } finally { client.release(); }
}
export async function trackTicket(req,res) {
  res.set("Cache-Control","no-store");
  const token = req.params.token;
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token)) return res.status(404).json({ error: "Link inválido" });
  try {
    const { rows } = await getPool().query(
      "SELECT e.ticket_code,e.status,e.legal_priority,e.enqueued_at,j.started_at,qd.name AS queue_name,qd.stage_type,e.called_at, ce.called_at AS latest_called_at, rm.name AS destination_name, now() AS server_now, (SELECT count(*)::int FROM public.queue_entries ahead WHERE ahead.queue_id=e.queue_id AND ahead.status='waiting' AND (ahead.legal_priority AND NOT e.legal_priority OR ahead.legal_priority=e.legal_priority AND (ahead.enqueued_at, ahead.id) < (e.enqueued_at,e.id))) AS ahead FROM public.patient_journeys j JOIN public.queue_entries e ON e.journey_id=j.id JOIN public.queue_instances qi ON qi.id=e.queue_id JOIN public.queue_sessions qs ON qs.id=qi.session_id JOIN public.queue_definitions qd ON qd.id=qs.definition_id LEFT JOIN LATERAL (SELECT called_at,room_id FROM public.call_events WHERE queue_entry_id=e.id ORDER BY called_at DESC LIMIT 1) ce ON true LEFT JOIN public.rooms rm ON rm.id=ce.room_id WHERE j.tracking_token_hash=$1 AND j.tracking_expires_at > now() AND j.tracking_revoked_at IS NULL ORDER BY e.enqueued_at DESC LIMIT 1",
      [hash(token)]
    );
    if (!rows[0]) return res.status(404).json({ error: "Link inválido ou expirado" });
    const ticket = rows[0];
    const averageMinutes = ticket.stage_type === "reception" ? 5 : ticket.stage_type === "consultation" ? 20 : null;
    const ahead = Number(ticket.ahead);
    const estimatedWaitMinutes = ticket.status === "waiting" && averageMinutes !== null && Number.isFinite(ahead)
      ? Math.max(0, ahead) * averageMinutes
      : null;
    return res.json({ ...ticket, estimated_wait_minutes: estimatedWaitMinutes });
  } catch { return res.status(503).json({ error: "Acompanhamento indisponível" }); }
}
