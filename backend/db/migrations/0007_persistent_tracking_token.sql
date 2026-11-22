BEGIN;
ALTER TABLE public.patient_journeys ADD COLUMN IF NOT EXISTS tracking_token_encrypted TEXT;
INSERT INTO public.schema_migrations(version) VALUES ('0007_persistent_tracking_token') ON CONFLICT DO NOTHING;
COMMIT;
