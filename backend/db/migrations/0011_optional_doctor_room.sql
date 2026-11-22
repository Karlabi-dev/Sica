-- Cadastro de médicos independente de consultório e fila.
-- A atribuição de consultório ocorre na configuração da equipe de atendimento.
BEGIN;
ALTER TABLE public.doctor_profiles ALTER COLUMN room_id DROP NOT NULL;
INSERT INTO public.schema_migrations(version) VALUES ('0011_optional_doctor_room') ON CONFLICT DO NOTHING;
COMMIT;
