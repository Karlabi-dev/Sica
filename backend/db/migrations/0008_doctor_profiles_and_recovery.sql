-- SICA: estrutura para cadastro de médicos e recuperação excepcional de senhas.
-- Aplicar após 0007. Não executa alterações de dados de pacientes existentes.
BEGIN;

CREATE TABLE IF NOT EXISTS public.doctor_profiles (
  staff_user_id UUID PRIMARY KEY REFERENCES public.staff_users(id) ON DELETE RESTRICT,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE RESTRICT,
  queue_definition_id UUID NOT NULL REFERENCES public.queue_definitions(id) ON DELETE RESTRICT,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Uma fila compartilhada pode ter vários médicos; uma fila individual só um.
CREATE UNIQUE INDEX IF NOT EXISTS uq_doctor_profile_room
  ON public.doctor_profiles(room_id) WHERE enabled = TRUE;

ALTER TABLE public.queue_entries
  ADD COLUMN IF NOT EXISTS exceptional_recovery BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS recovery_reason VARCHAR(300),
  ADD COLUMN IF NOT EXISTS recovered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS recovered_by UUID REFERENCES public.staff_users(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_queue_recovery_order
  ON public.queue_entries(queue_id, exceptional_recovery DESC, legal_priority DESC, enqueued_at, id)
  WHERE status = 'waiting';

INSERT INTO public.schema_migrations(version)
VALUES ('0008_doctor_profiles_and_recovery')
ON CONFLICT DO NOTHING;

COMMIT;
