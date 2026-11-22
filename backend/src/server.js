import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { checkDatabase, closeDatabase } from "./config/database.js";
import { staffAuth } from "./auth/firebaseAdmin.js";
import { revokeAdminSession } from "./auth/adminEmailSession.js";
import { clinicPublic, issueKioskTicket, trackTicket } from "./kiosk/tickets.js";
import { requestAdminEmailCode, verifyAdminEmailCode } from "./auth/adminEmailChallenge.js";

const app = express();
app.disable("x-powered-by");
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
app.post("/public/kiosk/tickets", issueKioskTicket);
app.get("/public/track/:token", trackTicket);

app.post("/auth/admin/email-code/request", requestAdminEmailCode);
app.post("/auth/admin/email-code/verify", verifyAdminEmailCode);

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
