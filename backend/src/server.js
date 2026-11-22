import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { checkDatabase, closeDatabase } from "./config/database.js";
import { staffAuth } from "./auth/firebaseAdmin.js";
import { rateLimit } from "./security/rateLimit.js";
import { revokeAdminSession } from "./auth/adminEmailSession.js";
import { clinicPublic, issueKioskTicket, trackTicket } from "./kiosk/tickets.js";
import { requestAdminEmailCode, verifyAdminEmailCode } from "./auth/adminEmailChallenge.js";
import { receptionOverview, receptionCall, receptionArrival, receptionHandoff, receptionTrackingLink } from "./reception/operations.js";

import { adminAttendance, adminAttendanceTracking } from "./admin/attendance.js";
import { adminPatients, adminPatientJourney, adminAudit, adminCatalog, adminCatalogWrite, adminCatalogDelete, adminSeedSpecialties, adminQueuesWrite } from "./admin/management.js";
import { updateQueueDoctors } from "./admin/queueDoctors.js";
import { medicalOverview, medicalAction } from "./medical/operations.js";
import { doctorCatalog, createDoctor, updateDoctor } from "./admin/doctors.js";
import { requestDevice, deviceStatus, operationalAuth, listDevices, approveDevice, revokeDevice } from "./devices/access.js";

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(helmet());
app.use(express.json({ limit: "32kb" }));

const allowedOrigins = (process.env.CORS_ORIGINS ?? "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("CORS origin not allowed"));
    },
  })
);

app.get("/health", (_req, res) => {
  res.set("Cache-Control", "no-store");
  res.status(200).json({ status: "ok", service: "sica-api" });
});

// Readiness endpoint: does not expose database names, credentials or error details.
app.get("/ready", async (_req, res) => {
  res.set("Cache-Control", "no-store");
  try {
    await checkDatabase();
    res.status(200).json({ status: "ready" });
  } catch (error) {
    console.error("Database readiness check failed", {
      code: error.code ?? "UNKNOWN",
    });
    res.status(503).json({ status: "unavailable" });
  }
});

app.get("/public/clinic", clinicPublic);
app.post("/public/kiosk/tickets", rateLimit({windowMs:60000,max:15}), issueKioskTicket);
app.get("/public/track/:token", trackTicket);
app.post("/devices/request", rateLimit({windowMs:3600000,max:8}), requestDevice);
app.get("/devices/status", deviceStatus);
app.get("/admin/attendance",staffAuth,adminAttendance);
app.post("/admin/attendance/:entryId/tracking-link",staffAuth,adminAttendanceTracking);
app.get("/admin/patients",staffAuth,adminPatients);
app.get("/admin/patients/:id",staffAuth,adminPatientJourney);
app.get("/admin/audit",staffAuth,adminAudit);
app.get("/admin/catalog",staffAuth,adminCatalog);
app.post("/admin/catalog/specialties/seed",staffAuth,adminSeedSpecialties);
app.post("/admin/catalog/queues",staffAuth,adminQueuesWrite);
app.patch("/admin/catalog/queues/:id/doctors",staffAuth,updateQueueDoctors);
app.post("/admin/catalog/:kind",staffAuth,adminCatalogWrite);
app.patch("/admin/catalog/:kind/:id",staffAuth,adminCatalogWrite);
app.delete("/admin/catalog/:kind/:id",staffAuth,adminCatalogDelete);
app.get("/admin/doctors", staffAuth, doctorCatalog);
app.post("/admin/doctors", staffAuth, createDoctor);
app.patch("/admin/doctors/:id", staffAuth, updateDoctor);
app.get("/admin/devices", staffAuth, listDevices);
app.patch("/admin/devices/:id/approve", staffAuth, approveDevice);
app.post("/admin/devices/:id/revoke", staffAuth, revokeDevice);
app.get("/staff/medical/overview", operationalAuth, medicalOverview);
app.post("/staff/medical/entries/:entryId/:action", operationalAuth, medicalAction);
app.get("/staff/reception/overview", operationalAuth, receptionOverview);
app.post("/staff/reception/entries/:entryId/call", operationalAuth, receptionCall);
app.post("/staff/reception/entries/:entryId/arrival", operationalAuth, receptionArrival);
app.post("/staff/reception/entries/:entryId/handoff", operationalAuth, receptionHandoff);
app.post("/staff/reception/entries/:entryId/tracking-link", operationalAuth, receptionTrackingLink);

app.post("/auth/admin/email-code/request", rateLimit({windowMs:900000,max:6}), requestAdminEmailCode);
app.post("/auth/admin/email-code/verify", rateLimit({windowMs:900000,max:15}), verifyAdminEmailCode);

app.post("/auth/admin/logout", staffAuth, async (req, res) => {
  if (req.staff.role !== "admin") return res.status(403).json({ error: "Forbidden" });
  await revokeAdminSession(req.staff.id, req.adminSessionToken);
  return res.status(204).end();
});

app.get("/auth/me", staffAuth, (req, res) => {
  res.set("Cache-Control", "no-store");
  res.status(200).json(req.staff);
});

app.use((_req, res) => res.status(404).json({ error: "Not found" }));
app.use((error, _req, res, _next) => {
  if (error.message === "CORS origin not allowed") {
    return res.status(403).json({ error: "Origin not allowed" });
  }
  console.error("Unhandled API error", { code: error.code ?? "UNKNOWN" });
  return res.status(500).json({ error: "Internal server error" });
});

const port = Number(process.env.PORT ?? 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535");
}

const server = app.listen(port, () => {
  console.log(`SICA API listening on port ${port}`);
});

async function shutdown() {
  server.close(async () => {
    try {
      await closeDatabase();
      process.exit(0);
    } catch {
      process.exit(1);
    }
  });
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
