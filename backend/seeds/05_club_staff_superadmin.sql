-- ============================================================
-- ClubSystem — Seed ClubStaff: Superadmin multi-club
-- ============================================================
-- Vincula admin@loscardos.com como OWNER en los 4 clubs.
-- Así al hacer login ve el ClubSwitcher con los 4 clubs disponibles.
--
-- Contraseña: Admin1234!
-- Requisito: ejecutar DESPUÉS de que el backend haya corrido al menos
--            una vez (para que SQLAlchemy cree la tabla club_staff).
-- ============================================================

INSERT INTO club_staff (id, email, club_id, role, user_id, is_active, created_at, updated_at)
VALUES
  -- Los Cardos Rugby Club
  (
    gen_random_uuid(),
    'admin@loscardos.com',
    '0fefa106-be3d-4c6c-90a5-c5b1a641c0b4',
    'OWNER',
    (SELECT id FROM users WHERE email = 'admin@loscardos.com' LIMIT 1),
    true,
    NOW(), NOW()
  ),
  -- Uncas Rugby Club
  (
    gen_random_uuid(),
    'admin@loscardos.com',
    'e5f3be47-9620-42b8-8ddc-44e7219c6fbd',
    'OWNER',
    (SELECT id FROM users WHERE email = 'admin@uncas.com' LIMIT 1),
    true,
    NOW(), NOW()
  ),
  -- Club Los 50
  (
    gen_random_uuid(),
    'admin@loscardos.com',
    'd31fec3e-4681-4329-b369-ce8639abf03e',
    'OWNER',
    (SELECT id FROM users WHERE email = 'admin@los50.com' LIMIT 1),
    true,
    NOW(), NOW()
  ),
  -- Club Nahuel
  (
    gen_random_uuid(),
    'admin@loscardos.com',
    '68b28494-ef4a-46a5-894c-6661f960e871',
    'OWNER',
    (SELECT id FROM users WHERE email = 'admin@nahuel.com' LIMIT 1),
    true,
    NOW(), NOW()
  )
ON CONFLICT (email, club_id) DO NOTHING;

-- Verificar resultado
SELECT
  cs.email,
  c.name  AS club,
  cs.role,
  cs.is_active
FROM club_staff cs
JOIN clubs c ON c.id = cs.club_id
WHERE cs.email = 'admin@loscardos.com'
ORDER BY c.name;
