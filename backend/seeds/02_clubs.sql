-- ============================================================
-- ClubSystem — Seed de clubes reales (Tandil)
-- Ejecutar DESPUÉS de arrancar el backend (que crea las tablas via SQLAlchemy)
-- Nota: sport_types es VARCHAR[] en SQLAlchemy, no usa ENUM de PostgreSQL
-- ============================================================

INSERT INTO clubs (
  id,
  slug,
  name,
  sport_types,
  primary_color,
  accent_color,
  city,
  country,
  plan,
  is_active
) VALUES
(
  '0fefa106-be3d-4c6c-90a5-c5b1a641c0b4',
  'los-cardos-rugby-club',
  'Los Cardos Rugby Club',
  ARRAY['rugby','hockey','tennis'],
  '#1A4731',
  '#2D6A4F',
  'Tandil',
  'AR',
  'starter',
  TRUE
),
(
  'e5f3be47-9620-42b8-8ddc-44e7219c6fbd',
  'uncas-rugby-club',
  'Uncas Rugby Club',
  ARRAY['rugby','hockey','tennis'],
  '#F5C400',
  '#1A1A1A',
  'Tandil',
  'AR',
  'starter',
  TRUE
),
(
  'd31fec3e-4681-4329-b369-ce8639abf03e',
  'club-los-50',
  'Club Los 50',
  ARRAY['rugby','hockey'],
  '#4CAF50',
  '#388E3C',
  'Tandil',
  'AR',
  'starter',
  TRUE
),
(
  '68b28494-ef4a-46a5-894c-6661f960e871',
  'club-nahuel',
  'Club Nahuel',
  ARRAY['football','tennis','padel'],
  '#29ABE2',
  '#0077B6',
  'Tandil',
  'AR',
  'starter',
  TRUE
)
ON CONFLICT (slug) DO NOTHING;

SELECT id, slug, name, sport_types, primary_color, plan FROM clubs ORDER BY name;
