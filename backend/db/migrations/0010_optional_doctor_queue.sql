-- O médico pode ser cadastrado antes de ser vinculado a uma fila.
BEGIN;
ALTER TABLE public.doctor_profiles ALTER COLUMN queue_definition_id DROP NOT NULL;
INSERT INTO public.schema_migrations(version) VALUES ('0010_optional_doctor_queue') ON CONFLICT DO NOTHING;
COMMIT;
