-- ============================================================
-- ClubSystem — Seed de canchas y reservas de prueba
-- Ejecutar DESPUÉS de 03_users.sql
-- Club: Los Cardos Rugby Club (id: 0fefa106-be3d-4c6c-90a5-c5b1a641c0b4)
-- ============================================================

-- ── 1. Canchas ────────────────────────────────────────────────
INSERT INTO courts (id, club_id, name, sport, surface, is_indoor, is_active, capacity, hourly_rate) VALUES
(
  'a1b2c3d4-0001-0001-0001-000000000001',
  '0fefa106-be3d-4c6c-90a5-c5b1a641c0b4',
  'Cancha 1 (Polvo)',
  'tennis',
  'clay',
  false,
  true,
  4,
  1500.00
),
(
  'a1b2c3d4-0001-0001-0001-000000000002',
  '0fefa106-be3d-4c6c-90a5-c5b1a641c0b4',
  'Cancha 2 (Polvo)',
  'tennis',
  'clay',
  false,
  true,
  4,
  1500.00
),
(
  'a1b2c3d4-0001-0001-0001-000000000003',
  '0fefa106-be3d-4c6c-90a5-c5b1a641c0b4',
  'Cancha 3 (Rápida)',
  'tennis',
  'hard',
  false,
  true,
  4,
  2000.00
),
(
  'a1b2c3d4-0001-0001-0001-000000000004',
  '0fefa106-be3d-4c6c-90a5-c5b1a641c0b4',
  'Cancha 4 (Cubierta)',
  'padel',
  'synthetic',
  true,
  true,
  2,
  2500.00
)
ON CONFLICT (id) DO NOTHING;

-- ── 2. Usuarios de prueba ─────────────────────────────────────
-- Contraseña para todos: Admin1234!
INSERT INTO users (
  id, club_id, role, email, password_hash,
  first_name, last_name, phone, dni, member_number, joined_at, is_active, email_verified
) VALUES
(
  'b2c3d4e5-0002-0002-0002-000000000001',
  '0fefa106-be3d-4c6c-90a5-c5b1a641c0b4',
  'member',
  'fermín@loscardos.com',
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/HS4W3Gy',
  'Fermín', 'Lasarte',
  '2494123456', '38123456', 'LC-001',
  '2020-03-01', true, true
),
(
  'b2c3d4e5-0002-0002-0002-000000000002',
  '0fefa106-be3d-4c6c-90a5-c5b1a641c0b4',
  'member',
  'martin@loscardos.com',
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/HS4W3Gy',
  'Martín', 'González',
  '2494234567', '37234567', 'LC-002',
  '2019-06-15', true, true
),
(
  'b2c3d4e5-0002-0002-0002-000000000003',
  '0fefa106-be3d-4c6c-90a5-c5b1a641c0b4',
  'member',
  'laura@loscardos.com',
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/HS4W3Gy',
  'Laura', 'Rodríguez',
  '2494345678', '39345678', 'LC-003',
  '2021-01-10', true, true
),
(
  'b2c3d4e5-0002-0002-0002-000000000004',
  '0fefa106-be3d-4c6c-90a5-c5b1a641c0b4',
  'member',
  'pablo@loscardos.com',
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/HS4W3Gy',
  'Pablo', 'Fernández',
  '2494456789', '35456789', 'LC-004',
  '2018-09-20', true, true
)
ON CONFLICT (club_id, email) DO NOTHING;

-- ── 3. Reservas para HOY (2026-03-17) ────────────────────────
-- Nota: timestamps en UTC (Argentina es UTC-3, entonces 16:00 local = 19:00 UTC)
INSERT INTO reservations (
  id, club_id, court_id, user_id,
  status, starts_at, ends_at,
  total_price, paid_amount, notes
) VALUES
-- Cancha 1 / 13:00-14:30 local (16:00-17:30 UTC) - confirmada
(
  gen_random_uuid(),
  '0fefa106-be3d-4c6c-90a5-c5b1a641c0b4',
  'a1b2c3d4-0001-0001-0001-000000000001',
  'b2c3d4e5-0002-0002-0002-000000000001',
  'confirmed',
  '2026-03-17 16:00:00+00',
  '2026-03-17 17:30:00+00',
  1500.00, 1500.00,
  'Clase con el profe'
),
-- Cancha 1 / 16:30-18:00 local (19:30-21:00 UTC) - pendiente
(
  gen_random_uuid(),
  '0fefa106-be3d-4c6c-90a5-c5b1a641c0b4',
  'a1b2c3d4-0001-0001-0001-000000000001',
  'b2c3d4e5-0002-0002-0002-000000000002',
  'pending',
  '2026-03-17 19:30:00+00',
  '2026-03-17 21:00:00+00',
  1500.00, 0.00,
  NULL
),
-- Cancha 2 / 14:00-15:30 local (17:00-18:30 UTC) - confirmada
(
  gen_random_uuid(),
  '0fefa106-be3d-4c6c-90a5-c5b1a641c0b4',
  'a1b2c3d4-0001-0001-0001-000000000002',
  'b2c3d4e5-0002-0002-0002-000000000003',
  'confirmed',
  '2026-03-17 17:00:00+00',
  '2026-03-17 18:30:00+00',
  1500.00, 1500.00,
  NULL
),
-- Cancha 2 / 18:00-19:30 local (21:00-22:30 UTC) - bloqueada (torneo)
(
  gen_random_uuid(),
  '0fefa106-be3d-4c6c-90a5-c5b1a641c0b4',
  'a1b2c3d4-0001-0001-0001-000000000002',
  (SELECT id FROM users WHERE email = 'admin@loscardos.com' LIMIT 1),
  'confirmed',
  '2026-03-17 21:00:00+00',
  '2026-03-17 22:30:00+00',
  0.00, 0.00,
  'Torneo Local — Cancha reservada'
),
-- Cancha 3 / 15:00-16:30 local (18:00-19:30 UTC) - confirmada
(
  gen_random_uuid(),
  '0fefa106-be3d-4c6c-90a5-c5b1a641c0b4',
  'a1b2c3d4-0001-0001-0001-000000000003',
  'b2c3d4e5-0002-0002-0002-000000000004',
  'confirmed',
  '2026-03-17 18:00:00+00',
  '2026-03-17 19:30:00+00',
  2000.00, 2000.00,
  NULL
),
-- Cancha 4 (Padel) / 17:00-18:30 local (20:00-21:30 UTC) - confirmada
(
  gen_random_uuid(),
  '0fefa106-be3d-4c6c-90a5-c5b1a641c0b4',
  'a1b2c3d4-0001-0001-0001-000000000004',
  'b2c3d4e5-0002-0002-0002-000000000001',
  'confirmed',
  '2026-03-17 20:00:00+00',
  '2026-03-17 21:30:00+00',
  2500.00, 2500.00,
  'Reserva fija — lunes y martes'
)
ON CONFLICT DO NOTHING;

-- ── 4. Verificar ──────────────────────────────────────────────
SELECT
  r.starts_at AT TIME ZONE 'America/Argentina/Buenos_Aires' AS hora_local,
  c.name AS cancha,
  u.first_name || ' ' || u.last_name AS jugador,
  r.status,
  r.total_price
FROM reservations r
JOIN courts c ON c.id = r.court_id
JOIN users u ON u.id = r.user_id
WHERE r.club_id = '0fefa106-be3d-4c6c-90a5-c5b1a641c0b4'
ORDER BY r.starts_at;
