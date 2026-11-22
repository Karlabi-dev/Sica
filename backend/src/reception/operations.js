import { getPool } from "../config/database.js";

const allowed = (req,res) => {
  if (!["attendant","admin"].includes(req.staff?.role)) { res.status(403).json({error:"Acesso negado"}); return false; }
  return true;
};
const fail = (res,error) => { console.error("Reception error",{code:error.code??"UNKNOWN"}); return res.status(503).json({error:"Operação indisponível. Tente novamente."}); };

export async function receptionOverview(req,res) {
  res.set("Cache-Control","no-store");
  if (!allowed(req,res)) return;
  try {
    const pool=getPool();
    const [queues, entries] = await Promise.all([
      pool.query(`SELECT qd.id,qd.name,qd.stage_type, count(e.id) FILTER (WHERE e.status='waiting')::int AS waiting
        FROM public.queue_definitions qd LEFT JOIN public.queue_sessions qs ON qs.definition_id=qd.id AND qs.status='active'
        LEFT JOIN public.queue_instances qi ON qi.session_id=qs.id AND qi.active=true
        LEFT JOIN public.queue_entries e ON e.queue_id=qi.id
        WHERE qd.active=true GROUP BY qd.id,qd.name,qd.stage_type ORDER BY qd.stage_type,qd.name`),
      pool.query(`SELECT e.id,e.ticket_code,e.status,e.legal_priority,e.payment_category,e.enqueued_at,e.called_at,
        qd.name AS queue_name,qd.stage_type,p.full_name AS patient_name,p.phone AS patient_phone,
        rm.name AS destination_name
        FROM public.queue_entries e JOIN public.queue_instances qi ON qi.id=e.queue_id
        JOIN public.queue_sessions qs ON qs.id=qi.session_id JOIN public.queue_definitions qd ON qd.id=qs.definition_id
        JOIN public.patient_journeys j ON j.id=e.journey_id LEFT JOIN public.patients p ON p.id=j.patient_id
        LEFT JOIN LATERAL (SELECT room_id FROM public.call_events WHERE queue_entry_id=e.id ORDER BY called_at DESC LIMIT 1) ce ON true
        LEFT JOIN public.rooms rm ON rm.id=ce.room_id
        WHERE qs.status='active' AND e.status IN ('waiting','called','in_service','no_show','transferred')
        ORDER BY CASE WHEN e.status='waiting' THEN 0 ELSE 1 END,e.legal_priority DESC,e.enqueued_at ASC LIMIT 300`)
    ]);
    return res.json({queues:queues.rows,entries:entries.rows});
  } catch(error) { return fail(res,error); }
}

export async function receptionCall(req,res) {
  res.set("Cache-Control","no-store");
  if (!allowed(req,res)) return;
  const {entryId}=req.params;
  if (!/^[0-9a-f-]{36}$/i.test(entryId)) return res.status(400).json({error:"Senha inválida"});
  const client=await getPool().connect();
  try {
    await client.query("BEGIN");
    const {rows}=await client.query(`SELECT e.id,e.status,qd.stage_type FROM public.queue_entries e
      JOIN public.queue_instances qi ON qi.id=e.queue_id JOIN public.queue_sessions qs ON qs.id=qi.session_id
      JOIN public.queue_definitions qd ON qd.id=qs.definition_id WHERE e.id=$1 FOR UPDATE OF e`,[entryId]);
    if (!rows[0] || rows[0].stage_type!=="reception" || rows[0].status!=="waiting") {
      await client.query("ROLLBACK");return res.status(409).json({error:"Senha não está aguardando na recepção"});
    }
    const active=await client.query(`SELECT 1 FROM public.queue_entries e JOIN public.call_events c ON c.queue_entry_id=e.id
      WHERE e.status='called' AND c.called_by=$1 AND e.id<>$2 LIMIT 1`,[req.staff.id,entryId]);
    if (active.rows.length) {await client.query("ROLLBACK");return res.status(409).json({error:"Conclua a chamada atual antes de chamar outra senha"});}
    await client.query("UPDATE public.queue_entries SET status='called',called_at=now() WHERE id=$1",[entryId]);
    await client.query("INSERT INTO public.call_events(queue_entry_id,called_by,called_at) VALUES($1,$2,now())",[entryId,req.staff.id]);
    await client.query("COMMIT");
    return res.json({status:"called"});
  } catch(error) {await client.query("ROLLBACK").catch(()=>{});return fail(res,error);} finally {client.release();}
}

export async function receptionArrival(req,res) {
  res.set("Cache-Control","no-store");
  if (!allowed(req,res)) return;
  const {entryId}=req.params;
  if (!/^[0-9a-f-]{36}$/i.test(entryId)) return res.status(400).json({error:"Senha inválida"});
  try {
    const result=await getPool().query(`UPDATE public.queue_entries e SET status='in_service',service_started_at=now()
      FROM public.queue_instances qi JOIN public.queue_sessions qs ON qs.id=qi.session_id
      JOIN public.queue_definitions qd ON qd.id=qs.definition_id
      WHERE e.id=$1 AND e.queue_id=qi.id AND qd.stage_type='reception' AND e.status='called' RETURNING e.id`,[entryId]);
    if (!result.rowCount) return res.status(409).json({error:"A senha não está chamada na recepção"});
    return res.json({status:"in_service"});
  } catch(error) {return fail(res,error);}
}
