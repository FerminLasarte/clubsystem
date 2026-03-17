-- ============================================================
-- ClubSync — Seed de clubes reales (Tandil)
-- Ejecutar DESPUÉS de schema.sql
-- ============================================================

-- 1. Extender el ENUM sport_type con los deportes que faltan
--    (ALTER TYPE no se puede dentro de una transacción en algunos contextos,
--     por eso va primero y solo)
ALTER TYPE sport_type ADD VALUE IF NOT EXISTS 'rugby';
ALTER TYPE sport_type ADD VALUE IF NOT EXISTS 'hockey';

-- ============================================================
-- 2. Insertar los clubes
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
  gen_random_uuid(),
  'los-cardos-rugby-club',
  'Los Cardos Rugby Club',
  ARRAY['rugby','hockey','tennis']::sport_type[],
  '#1A4731',   -- verde oscuro
  '#2D6A4F',   -- verde oscuro claro (acento)
  'Tandil',
  'AR',
  'starter',
  TRUE
),
(
  gen_random_uuid(),
  'uncas-rugby-club',
  'Uncas Rugby Club',
  ARRAY['rugby','hockey','tennis']::sport_type[],
  '#F5C400',   -- amarillo
  '#1A1A1A',   -- negro (acento)
  'Tandil',
  'AR',
  'starter',
  TRUE
),
(
  gen_random_uuid(),
  'club-los-50',
  'Club Los 50',
  ARRAY['rugby','hockey']::sport_type[],
  '#4CAF50',   -- verde claro
  '#388E3C',   -- verde claro oscurecido (acento)
  'Tandil',
  'AR',
  'starter',
  TRUE
),
(
  gen_random_uuid(),
  'club-nahuel',
  'Club Nahuel',
  ARRAY['football','tennis','padel']::sport_type[],
  '#29ABE2',   -- celeste
  '#0077B6',   -- celeste oscuro (acento)
  'Tandil',
  'AR',
  'starter',
  TRUE
);

-- ============================================================
-- 3. Verificar inserción
-- ============================================================
SELECT id, slug, name, sport_types, primary_color, accent_color, plan
FROM clubs
ORDER BY created_at;