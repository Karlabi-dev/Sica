BEGIN;
ALTER TABLE public.clinic_settings
 ADD COLUMN IF NOT EXISTS preferences JSONB NOT NULL DEFAULT '{"theme":"light","fontScale":100,"highContrast":false,"reducedMotion":false,"arrivalToleranceMinutes":2}'::jsonb;
COMMIT;
