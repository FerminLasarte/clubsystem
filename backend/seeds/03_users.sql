-- ============================================================
-- Seed de usuarios admin para cada club
-- Contraseña para todos: Admin1234!
-- Hash generado con bcrypt (cost=12)
-- ============================================================

-- Para regenerar el hash desde Python:
-- from passlib.context import CryptContext
-- pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
-- print(pwd.hash("Admin1234!"))

INSERT INTO users (
  id, club_id, role, email, password_hash,
  first_name, last_name, is_active, email_verified
) VALUES
(
  gen_random_uuid(),
  '0fefa106-be3d-4c6c-90a5-c5b1a641c0b4',  -- Los Cardos
  'admin',
  'admin@loscardos.com',
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/HS4W3Gy',
  'Admin', 'Los Cardos',
  true, true
),
(
  gen_random_uuid(),
  'e5f3be47-9620-42b8-8ddc-44e7219c6fbd',  -- Uncas
  'admin',
  'admin@uncas.com',
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/HS4W3Gy',
  'Admin', 'Uncas',
  true, true
),
(
  gen_random_uuid(),
  'd31fec3e-4681-4329-b369-ce8639abf03e',  -- Club Los 50
  'admin',
  'admin@los50.com',
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/HS4W3Gy',
  'Admin', 'Los 50',
  true, true
),
(
  gen_random_uuid(),
  '68b28494-ef4a-46a5-894c-6661f960e871',  -- Club Nahuel
  'admin',
  'admin@nahuel.com',
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/HS4W3Gy',
  'Admin', 'Nahuel',
  true, true
);

-- Verificar
SELECT u.email, u.role, c.name as club
FROM users u JOIN clubs c ON c.id = u.club_id
ORDER BY c.name;
