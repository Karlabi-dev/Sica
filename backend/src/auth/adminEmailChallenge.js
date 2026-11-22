import { createHash, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { getAuth } from "firebase-admin/auth";
import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { issueAdminSession } from "./adminEmailSession.js";
import { getPool } from "../config/database.js";

function hashCode(id, code) {
 const secret = process.env.ADMIN_OTP_PEPPER;
 if (!secret || secret.length < 32) throw new Error("ADMIN_OTP_PEPPER must have at least 32 characters");
 return createHash("sha256").update(secret + ":" + id + ":" + code).digest("hex");
}
function firebaseAuth() {
 if (!getApps().length) initializeApp({ credential: applicationDefault(), projectId: process.env.FIREBASE_PROJECT_ID });
 return getAuth();
}
async function adminFromToken(req) {
 const match = /^Bearer ([^\s]+)$/.exec(req.get("authorization") ?? "");
 if (!match) return null;
 const decoded = await firebaseAuth().verifyIdToken(match[1], true);
 const { rows } = await getPool().query("SELECT id, email FROM public.staff_users WHERE firebase_uid=$1 AND role='admin' AND active=true AND mfa_required=true", [decoded.uid]);
 if (!rows[0]?.email || !decoded.email_verified || decoded.email?.toLowerCase() !== rows[0].email.toLowerCase()) return null;
 return rows[0];
}
const generic = { message: "Se o administrador estiver habilitado, prossiga com a verificação." };
function noStore(res) { res.set("Cache-Control", "no-store"); }
async function sendAdminCode(to, code) {
 const apiKey = process.env.BREVO_API_KEY;
 const from = process.env.BREVO_FROM_EMAIL ?? process.env.SMTP_FROM;
 if (!apiKey || !from || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(from)) {
  throw Object.assign(new Error("Brevo API credentials or verified sender not configured"), {code:"BREVO_CONFIG"});
 }
 const controller = new AbortController();
 const timeout = setTimeout(() => controller.abort(), 12000);
 try {
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
   method:"POST",
   headers:{"api-key":apiKey,"Content-Type":"application/json","Accept":"application/json"},
   body:JSON.stringify({
    sender:{name:"SICA",email:from},
    to:[{email:to}],
    subject:"SICA — código de verificação",
    textContent:"Seu código de verificação SICA é: "+code+"\nEle expira em 5 minutos. Se você não solicitou, ignore esta mensagem."
   }),
   signal:controller.signal
  });
  if (!response.ok) {
   throw Object.assign(new Error("Brevo rejected transactional email"), {code:"BREVO_HTTP_"+response.status});
  }
 } finally {clearTimeout(timeout);}
}

export async function requestAdminEmailCode(req, res) {
 noStore(res);
 let admin;
 try { admin = await adminFromToken(req); } catch { return res.status(401).json({ error: "Invalid authentication" }); }
 if (!admin) return res.status(403).json({ error: "Administrator account or verified email required" });
 try {
  const pool = getPool();
  const { rows } = await pool.query("SELECT count(*)::int AS count FROM public.admin_email_challenges WHERE staff_user_id=$1 AND created_at > now() - interval '15 minutes'", [admin.id]);
  if (rows[0].count >= 3) return res.status(429).json({ error: "Too many requests. Try again later." });
  const id = randomUUID();
  const code = String(randomInt(0, 1000000)).padStart(6, "0");
  const codeHash = hashCode(id, code);
  await pool.query("INSERT INTO public.admin_email_challenges(id,staff_user_id,code_hash,expires_at) VALUES ($1,$2,$3,now() + interval '5 minutes')", [id, admin.id, codeHash]);
  try {
   await sendAdminCode(admin.email, code);
  } catch (error) {
   await pool.query("DELETE FROM public.admin_email_challenges WHERE id=$1", [id]);
   throw error;
  }
  return res.status(200).json({ ...generic, challengeId: id, expiresInSeconds: 300 });
 } catch (error) {
  console.error("Admin OTP request failed", { code: error.code ?? "UNKNOWN" });
  return res.status(503).json({ error: "Verification email unavailable" });
 }
}
export async function verifyAdminEmailCode(req, res) {
 noStore(res);
 let admin;
 try { admin = await adminFromToken(req); } catch { return res.status(401).json({ error: "Invalid authentication" }); }
 if (!admin) return res.status(403).json({ error: "Administrator account or verified email required" });
 const { challengeId, code } = req.body ?? {};
 if (typeof challengeId !== "string" || !/^[0-9a-f-]{36}$/i.test(challengeId) || typeof code !== "string" || !/^\d{6}$/.test(code)) return res.status(400).json({ error: "Invalid verification input" });
 const client = await getPool().connect();
 try {
  await client.query("BEGIN");
  const { rows } = await client.query("SELECT code_hash,attempts,consumed_at,expires_at FROM public.admin_email_challenges WHERE id=$1 AND staff_user_id=$2 FOR UPDATE", [challengeId,admin.id]);
  const row = rows[0];
  if (!row || row.consumed_at || row.attempts >= 5 || new Date(row.expires_at).getTime() <= Date.now()) {
   await client.query("COMMIT");
   return res.status(400).json({ error: "Invalid or expired code" });
  }
  const actual = Buffer.from(hashCode(challengeId,code),"hex");
  const expected = Buffer.from(row.code_hash,"hex");
  const valid = actual.length === expected.length && timingSafeEqual(actual,expected);
  await client.query("UPDATE public.admin_email_challenges SET attempts=attempts+1,consumed_at=CASE WHEN $2 THEN now() ELSE consumed_at END WHERE id=$1", [challengeId,valid]);
  await client.query("COMMIT");
  if (!valid) return res.status(400).json({ error: "Invalid or expired code" });
  const session = await issueAdminSession(admin.id);
  return res.status(200).json({ verified: true, ...session });
 } catch (error) {
  await client.query("ROLLBACK").catch(()=>{});
  console.error("Admin OTP verification failed", { code: error.code ?? "UNKNOWN" });
  return res.status(503).json({ error: "Verification service unavailable" });
 } finally { client.release(); }
}
