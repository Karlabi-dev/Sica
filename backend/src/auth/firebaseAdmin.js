import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getPool } from "../config/database.js";

function adminAuth() {
  if (!getApps().length) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    if (!projectId) throw new Error("FIREBASE_PROJECT_ID is required");
    initializeApp({ credential: applicationDefault(), projectId });
  }
  return getAuth();
}

export async function staffAuth(req, res, next) {
  res.set("Cache-Control", "no-store");
  const header = req.get("authorization") ?? "";
  const match = /^Bearer ([^\s]+)$/.exec(header);
  if (!match) return res.status(401).json({ error: "Authentication required" });

  let decoded;
  try {
    decoded = await adminAuth().verifyIdToken(match[1], true);
  } catch (error) {
    if (!["auth/argument-error", "auth/id-token-expired", "auth/id-token-revoked", "auth/invalid-id-token"].includes(error.code)) {
      console.error("Firebase token verification failed", { code: error.code ?? "UNKNOWN" });
    }
    return res.status(401).json({ error: "Invalid or expired session" });
  }

  try {
    const { rows } = await getPool().query(
      "SELECT id, display_name, role, active, mfa_required FROM staff_users WHERE firebase_uid = $1",
      [decoded.uid]
    );
    const staff = rows[0];
    if (!staff?.active) return res.status(403).json({ error: "Access not authorized" });

    // MFA must be satisfied for administrators on every protected request.
    const secondFactor = decoded.firebase?.sign_in_second_factor;
    if (staff.role === "admin" && !secondFactor) {
      return res.status(403).json({ error: "Multi-factor authentication required" });
    }
    if (staff.mfa_required && !secondFactor) {
      return res.status(403).json({ error: "Multi-factor authentication required" });
    }
    req.staff = { id: staff.id, displayName: staff.display_name, role: staff.role };
    return next();
  } catch (error) {
    console.error("Staff authorization query failed", { code: error.code ?? "UNKNOWN" });
    return res.status(503).json({ error: "Authorization service unavailable" });
  }
}
