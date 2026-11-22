-- SICA: catálogo inicial de dez especialidades.
-- Idempotente: pode ser executado mais de uma vez sem duplicar nomes.
INSERT INTO public.specialties(name,active)
SELECT seed.name,seed.active
FROM (VALUES
 ('Clínica Geral',true),
 ('Pediatria',true),
 ('Cardiologia',true),
 ('Dermatologia',true),
 ('Ginecologia',true),
 ('Ortopedia e Traumatologia',true),
 ('Neurologia',true),
 ('Oftalmologia',true),
 ('Endocrinologia',true),
 ('Psiquiatria',true)
) AS seed(name,active)
WHERE NOT EXISTS (SELECT 1 FROM public.specialties s WHERE lower(trim(s.name))=lower(trim(seed.name)));
