import { createHash, randomBytes } from "node:crypto";
import { getPool } from "../config/database.js";

const digest = value => createHash("sha256").update(value).digest("hex");

export async function issueAdminSession(staffId) {
  const token = randomBytes(32).toString("hex");
  await getPool().query(
    "INSERT INTO public.admin_email_sessions(staff_user_id, token_hash, expires_at) VALUES ($1,$2,now() + interval '12 hours')",
    [staffId, digest(token)]
  );
  return { token, expiresInSeconds: 43200 };
}

export async function validAdminSession(staffId, token) {
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) return false;
  const { rows } = await getPool().query(
    "SELECT 1 FROM public.admin_email_sessions WHERE staff_user_id=$1 AND token_hash=$2 AND revoked_at IS NULL AND expires_at > now() LIMIT 1",
    [staffId, digest(token)]
  );
  return rows.length > 0;
}

export async function revokeAdminSession(staffId, token) {
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) return;
  await getPool().query(
    "UPDATE public.admin_email_sessions SET revoked_at=now() WHERE staff_user_id=$1 AND token_hash=$2",
    [staffId, digest(token)]
  );
}
