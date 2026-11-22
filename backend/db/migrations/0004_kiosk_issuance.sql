-- Kiosk ticket sequence and per-installation clinic branding.
BEGIN;
INSERT INTO public.clinic_settings(id,name,website_url,timezone)
VALUES (1,'SICA - FORTALEZA',NULL,'America/Fortaleza')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.queue_definitions(name,stage_type,queue_mode,active)
SELECT 'Recepção - Totem','reception','shared',true
WHERE NOT EXISTS (SELECT 1 FROM public.queue_definitions WHERE stage_type='reception' AND queue_mode='shared' AND active=true);
CREATE TABLE IF NOT EXISTS public.kiosk_ticket_counters (
  local_date DATE NOT NULL,
  category VARCHAR(32) NOT NULL CHECK (category IN ('convenio','convenio-prioridade','particular','particular-prioridade')),
  last_number INTEGER NOT NULL CHECK (last_number > 0),
  PRIMARY KEY(local_date,category)
);
CREATE TABLE IF NOT EXISTS public.kiosk_issuance_requests (
  request_id UUID PRIMARY KEY,
  journey_id UUID NOT NULL REFERENCES public.patient_journeys(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO public.schema_migrations(version) VALUES ('0004_kiosk_issuance') ON CONFLICT DO NOTHING;
COMMIT;
