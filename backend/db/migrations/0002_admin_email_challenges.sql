-- Execute once in Neon sica_db. Email OTP is a preparatory factor, not a Firebase MFA replacement.
BEGIN;
CREATE TABLE IF NOT EXISTS public.admin_email_challenges (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 staff_user_id UUID NOT NULL REFERENCES public.staff_users(id) ON DELETE CASCADE,
 code_hash CHAR(64) NOT NULL,
 expires_at TIMESTAMPTZ NOT NULL,
 attempts SMALLINT NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
 consumed_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_admin_email_challenges_staff ON public.admin_email_challenges(staff_user_id, created_at DESC);
INSERT INTO public.schema_migrations(version) VALUES ('0002_admin_email_challenges') ON CONFLICT DO NOTHING;
COMMIT;
