-- Demo-only queues and professionals. Run manually in Neon SQL Editor after migrations 0001-0005.
-- Uses simulated professional identities; do not use for real clinical appointments.
BEGIN;
INSERT INTO public.rooms(name) VALUES ('Consultório Clínica Geral'),('Consultório Pediatria'),('Sala Ultrassom') ON CONFLICT(name) DO NOTHING;
INSERT INTO public.staff_users(firebase_uid,display_name,role,active)
VALUES ('demo:sica:clinica-geral','Médico de teste — Clínica Geral','doctor',true),
('demo:sica:pediatria','Médico de teste — Pediatria','doctor',true),
('demo:sica:ultrassom','Médico de teste — Ultrassom','doctor',true)
ON CONFLICT(firebase_uid) DO NOTHING;
INSERT INTO public.queue_definitions(name,stage_type,queue_mode,active)
SELECT v.name,v.stage_type,'individual',true FROM
(VALUES ('Clínica Geral','consultation'),('Pediatria','consultation'),('Ultrassom','exam')) AS v(name,stage_type)
WHERE NOT EXISTS (SELECT 1 FROM public.queue_definitions q WHERE lower(q.name)=lower(v.name));
INSERT INTO public.schema_migrations(version) VALUES ('0006_demo_specialty_queues') ON CONFLICT DO NOTHING;
COMMIT;
