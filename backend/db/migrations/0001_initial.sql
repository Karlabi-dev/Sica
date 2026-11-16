-- SICA / PostgreSQL (Neon). Migration 0001.
-- Uma implantação = uma clínica = um banco de dados independente.
-- Não executar com pacientes reais sem revisão, testes e plano de backup.
BEGIN;

CREATE TABLE clinic_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  name VARCHAR(160) NOT NULL,
  website_url TEXT,
  timezone VARCHAR(64) NOT NULL DEFAULT 'America/Fortaleza',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE staff_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_uid VARCHAR(128) NOT NULL UNIQUE,
  display_name VARCHAR(160) NOT NULL,
  email VARCHAR(254),
  role VARCHAR(24) NOT NULL CHECK (role IN ('admin', 'attendant', 'doctor')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  mfa_required BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_staff_role_active ON staff_users(role, active);

CREATE TABLE patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name VARCHAR(180) NOT NULL,
  date_of_birth DATE,
  phone VARCHAR(40),
  email VARCHAR(254),
  external_identifier VARCHAR(80),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_patient_external_identifier ON patients(external_identifier)
  WHERE external_identifier IS NOT NULL;

CREATE TABLE specialties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE professional_specialties (
  staff_user_id UUID NOT NULL REFERENCES staff_users(id) ON DELETE RESTRICT,
  specialty_id UUID NOT NULL REFERENCES specialties(id) ON DELETE RESTRICT,
  PRIMARY KEY (staff_user_id, specialty_id)
);

CREATE TABLE professional_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_user_id UUID NOT NULL REFERENCES staff_users(id) ON DELETE RESTRICT,
  weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  CHECK (end_time > start_time)
);
CREATE INDEX idx_availability_staff_weekday ON professional_availability(staff_user_id, weekday);

CREATE TABLE queue_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL,
  stage_type VARCHAR(24) NOT NULL CHECK (stage_type IN ('reception','triage','consultation','exam')),
  specialty_id UUID REFERENCES specialties(id) ON DELETE RESTRICT,
  queue_mode VARCHAR(24) NOT NULL CHECK (queue_mode IN ('shared','individual')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_queue_def_stage ON queue_definitions(stage_type, active);

CREATE TABLE queue_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  definition_id UUID NOT NULL REFERENCES queue_definitions(id) ON DELETE RESTRICT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled','active','closed','cancelled')),
  created_by UUID REFERENCES staff_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);
CREATE INDEX idx_queue_sessions_time ON queue_sessions(starts_at, ends_at);

CREATE TABLE session_professionals (
  session_id UUID NOT NULL REFERENCES queue_sessions(id) ON DELETE CASCADE,
  professional_id UUID NOT NULL REFERENCES staff_users(id) ON DELETE RESTRICT,
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE RESTRICT,
  PRIMARY KEY (session_id, professional_id),
  UNIQUE (session_id, room_id)
);

CREATE TABLE queue_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES queue_sessions(id) ON DELETE RESTRICT,
  -- NULL: fila compartilhada. Preenchido: fila individual daquele profissional.
  professional_id UUID REFERENCES staff_users(id) ON DELETE RESTRICT,
  active BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE UNIQUE INDEX uq_queue_shared_per_session ON queue_instances(session_id)
  WHERE professional_id IS NULL;
CREATE UNIQUE INDEX uq_queue_individual_per_professional ON queue_instances(session_id, professional_id)
  WHERE professional_id IS NOT NULL;

CREATE TABLE patient_journeys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE RESTRICT,
  -- Recepção em totem pode iniciar sem paciente cadastrado.
  status VARCHAR(24) NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting','called','in_service','completed','cancelled')),
  tracking_token_hash CHAR(64) NOT NULL UNIQUE
    CHECK (tracking_token_hash ~ '^[0-9a-f]{64}$'),
  tracking_expires_at TIMESTAMPTZ NOT NULL,
  tracking_revoked_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX idx_journey_patient ON patient_journeys(patient_id, started_at DESC);

CREATE TABLE queue_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id UUID NOT NULL REFERENCES patient_journeys(id) ON DELETE RESTRICT,
  queue_id UUID NOT NULL REFERENCES queue_instances(id) ON DELETE RESTRICT,
  ticket_code VARCHAR(24) NOT NULL,
  payment_category VARCHAR(20) NOT NULL CHECK (payment_category IN ('insurance', 'private')),
  legal_priority BOOLEAN NOT NULL DEFAULT FALSE,
  status VARCHAR(24) NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting','called','in_service','no_show','transferred','completed','cancelled')),
  enqueued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  called_at TIMESTAMPTZ,
  service_started_at TIMESTAMPTZ,
  service_finished_at TIMESTAMPTZ,
  UNIQUE (queue_id, ticket_code)
);
CREATE UNIQUE INDEX uq_one_active_queue_entry_per_journey ON queue_entries(journey_id)
  WHERE status IN ('waiting','called','in_service');
CREATE INDEX idx_queue_waiting ON queue_entries(queue_id, legal_priority, enqueued_at, id)
  WHERE status = 'waiting';
CREATE INDEX idx_journey_queue_history ON queue_entries(journey_id, enqueued_at);

CREATE TABLE call_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_entry_id UUID NOT NULL REFERENCES queue_entries(id) ON DELETE RESTRICT,
  called_by UUID NOT NULL REFERENCES staff_users(id) ON DELETE RESTRICT,
  room_id UUID REFERENCES rooms(id) ON DELETE RESTRICT,
  called_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_calls_recent ON call_events(called_at DESC);

CREATE TABLE queue_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id UUID NOT NULL REFERENCES patient_journeys(id) ON DELETE RESTRICT,
  from_entry_id UUID NOT NULL REFERENCES queue_entries(id) ON DELETE RESTRICT,
  to_entry_id UUID NOT NULL REFERENCES queue_entries(id) ON DELETE RESTRICT,
  transferred_by UUID NOT NULL REFERENCES staff_users(id) ON DELETE RESTRICT,
  reason VARCHAR(120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (from_entry_id <> to_entry_id)
);

CREATE TABLE tv_panels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE tv_panel_queues (
  panel_id UUID NOT NULL REFERENCES tv_panels(id) ON DELETE CASCADE,
  queue_id UUID NOT NULL REFERENCES queue_instances(id) ON DELETE CASCADE,
  PRIMARY KEY (panel_id, queue_id)
);

CREATE TABLE media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_staff_id UUID NOT NULL REFERENCES staff_users(id) ON DELETE RESTRICT,
  provider VARCHAR(32) NOT NULL DEFAULT 'cloudinary' CHECK (provider = 'cloudinary'),
  provider_asset_id VARCHAR(255) NOT NULL UNIQUE,
  provider_public_id VARCHAR(255) NOT NULL UNIQUE,
  delivery_type VARCHAR(24) NOT NULL DEFAULT 'authenticated'
    CHECK (delivery_type IN ('authenticated','private')),
  uploaded_by UUID NOT NULL REFERENCES staff_users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE idempotency_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation VARCHAR(100) NOT NULL,
  request_key VARCHAR(180) NOT NULL,
  fingerprint_sha256 CHAR(64) NOT NULL CHECK (fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  result_reference UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (operation, request_key)
);

CREATE TABLE audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES staff_users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(80) NOT NULL,
  resource_id UUID,
  request_id UUID,
  -- Metadados devem conter IDs e estados, NUNCA dados clínicos/tokens/senhas.
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_created ON audit_events(created_at DESC);
CREATE INDEX idx_audit_resource ON audit_events(resource_type, resource_id, created_at DESC);

CREATE TABLE schema_migrations (
  version VARCHAR(100) PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO schema_migrations(version) VALUES ('0001_initial');

COMMIT;
