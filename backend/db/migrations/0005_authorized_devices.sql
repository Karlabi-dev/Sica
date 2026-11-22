BEGIN;
CREATE TABLE IF NOT EXISTS public.authorized_devices (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 device_token_hash CHAR(64) NOT NULL UNIQUE,
 name VARCHAR(120),
 role VARCHAR(20) CHECK (role IN ('attendant','doctor')),
 room_id UUID REFERENCES public.rooms(id) ON DELETE RESTRICT,
 staff_user_id UUID UNIQUE REFERENCES public.staff_users(id) ON DELETE RESTRICT,
 status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','revoked')),
 requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 approved_at TIMESTAMPTZ,
 approved_by UUID REFERENCES public.staff_users(id) ON DELETE SET NULL,
 last_seen_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_authorized_devices_status ON public.authorized_devices(status,requested_at);
INSERT INTO public.schema_migrations(version) VALUES ('0005_authorized_devices') ON CONFLICT DO NOTHING;
COMMIT;
