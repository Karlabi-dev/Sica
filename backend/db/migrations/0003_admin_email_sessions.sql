BEGIN;
CREATE TABLE IF NOT EXISTS public.admin_email_sessions (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 staff_user_id UUID NOT NULL REFERENCES public.staff_users(id) ON DELETE CASCADE,
 token_hash CHAR(64) NOT NULL UNIQUE,
 expires_at TIMESTAMPTZ NOT NULL,
 revoked_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_admin_email_sessions_staff ON public.admin_email_sessions(staff_user_id, expires_at DESC);
INSERT INTO public.schema_migrations(version) VALUES ('0003_admin_email_sessions') ON CONFLICT DO NOTHING;
COMMIT;
