import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getPool } from "../config/database.js";
import { validAdminSession } from "./adminEmailSession.js";
function adminAuth() {
  if (!getApps().length) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    if (!projectId) {
      throw new Error("FIREBASE_PROJECT_ID is required");
    }
    initializeApp({
      credential: applicationDefault(),
      projectId,
    });
  }
  return getAuth();
}
export async function staffAuth(req, res, next) {
  res.set("Cache-Control", "no-store");
  const header = req.get("authorization") ?? "";
  const match = /^Bearer ([^\s]+)$/.exec(header);
  if (!match) {
    return res.status(401).json({
      error: "Authentication required",
    });
  }
  let decoded;
  try {
    decoded = await adminAuth().verifyIdToken(match[1], true);
  } catch (error) {
    console.error("Firebase token verification failed", {
      code: error.code ?? "UNKNOWN",
      message: error.message,
    });
    return res.status(401).json({
      error: "Invalid or expired session",
    });
  }
  try {
    const { rows } = await getPool().query(
      `SELECT id, display_name, role, active, mfa_required
       FROM public.staff_users
       WHERE firebase_uid = $1`,
      [decoded.uid]
    );
    const staff = rows[0];
    if (!staff?.active) {
      return res.status(403).json({
        error: "Access not authorized",
      });
    }
    const secondFactor = decoded.firebase?.sign_in_second_factor;
    const emailSession = staff.role === "admin" && !secondFactor
      ? await validAdminSession(staff.id, req.get("x-admin-session"))
      : false;
    if ((staff.role === "admin" || staff.mfa_required) && !secondFactor && !emailSession) {
      return res.status(403).json({
        error: "Multi-factor authentication required",
      });
    }
    req.adminSessionToken = emailSession ? req.get("x-admin-session") : null;
    req.staff = {
      id: staff.id,
      displayName: staff.display_name,
      role: staff.role,
    };
    return next();
  } catch (error) {
    console.error("Staff authorization query failed", {
      code: error.code ?? "UNKNOWN",
    });
    return res.status(503).json({
      error: "Authorization service unavailable",
    });
  }
}
