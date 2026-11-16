# SICA backend — initial Neon connection

This is the **first backend foundation**, not a production-ready clinical API. It has no patient endpoints, authentication, RBAC, audit middleware, rate limiting or Cloudinary integration yet.

## Local setup

Requirements: Node.js 22+ and a Neon database with migration `0001_initial.sql` applied.

1. From `backend/`, run `npm install`.
2. Copy `.env.example` to `.env`.
3. In **your local `.env` only**, replace the placeholder `DATABASE_URL` with the **direct** Neon PostgreSQL connection string for `sica_db`. Keep `sslmode=require`.
4. Run `npm run dev`.
5. Visit `http://localhost:3001/health` (API process running) and `http://localhost:3001/ready` (database reachable).

Expected responses:
- `/health`: `{"status":"ok","service":"sica-api"}`
- `/ready`: `{"status":"ready"}` or HTTP 503 if database is unavailable.

**Never paste a real connection URL into chat or commit `.env`.** The root `.gitignore` excludes `.env` and `.env.*`, except `.env.example`.

## Security notes

- PostgreSQL is accessed only by the server; the frontend must not receive `DATABASE_URL`.
- Neon URI enables TLS with `sslmode=require`. Certificate verification must not be disabled.
- Restrict `CORS_ORIGINS` to the actual frontend origin(s); CORS is **not** authentication.
- The connection uses a small application pool (`max: 5`) even with Neon's direct connection URL.
- `/ready` intentionally does not reveal connection details.
- The Neon owner credential is suitable for initial local setup only. Before production, create a **least-privilege runtime database role** and keep schema migrations on a separate privileged role.
- Do not expose the API publicly with clinical data until Firebase ID-token verification, authorization, input validation, request limits, and auditing are implemented and tested.
- No live Neon connection or `npm install` was executed by this GitHub commit.
