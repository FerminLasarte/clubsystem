"""
Verifica que la base quedó como la necesita el aislamiento por club. Corre después de las
migraciones (CI y pre-deploy) con el rol dueño (MIGRATIONS_DATABASE_URL).

  - El rol de la app no es superusuario, no tiene BYPASSRLS y no es dueño de nada.
  - El rol dueño tiene BYPASSRLS (las tablas tienen FORCE: sin eso, los scripts no ven datos).
  - Toda tabla con club_id (y clubs) tiene RLS activa y forzada.
  - Ningún otro rol tiene permisos sobre las tablas, ni puede ejecutar las funciones
    SECURITY DEFINER. En Supabase eso cubre a anon/authenticated/service_role de la Data API.

Uso:  poetry run python scripts/check_db.py   (sale con 1 si encuentra algún problema)
"""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from app.core.config import get_settings

_GRANTEE = "CASE WHEN acl.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(acl.grantee) END"

CHECKS: tuple[tuple[str, str], ...] = (
    (
        "El rol de la app tiene privilegios de más",
        "SELECT rolname || ': superuser=' || rolsuper || ', bypassrls=' || rolbypassrls"
        " || ', createrole=' || rolcreaterole || ', createdb=' || rolcreatedb"
        " FROM pg_roles WHERE rolname = :app"
        " AND (rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb)",
    ),
    (
        "El rol de la app no existe",
        "SELECT CAST(:app AS text) WHERE NOT EXISTS"
        " (SELECT 1 FROM pg_roles WHERE rolname = CAST(:app AS text))",
    ),
    (
        "El rol dueño no tiene BYPASSRLS",
        "SELECT rolname FROM pg_roles WHERE rolname = current_user"
        " AND NOT (rolbypassrls OR rolsuper)",
    ),
    (
        "El rol de la app es dueño de objetos",
        "SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace"
        " WHERE n.nspname = 'public' AND c.relowner = (SELECT oid FROM pg_roles"
        " WHERE rolname = :app)",
    ),
    (
        "Tablas de club sin RLS forzada",
        "SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace"
        " WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')"
        " AND (c.relname = 'clubs' OR EXISTS (SELECT 1 FROM pg_attribute a"
        "      WHERE a.attrelid = c.oid AND a.attname = 'club_id' AND NOT a.attisdropped))"
        " AND NOT (c.relrowsecurity AND c.relforcerowsecurity)",
    ),
    (
        "Permisos sobre tablas para roles ajenos",
        f"SELECT DISTINCT c.relname || ' → ' || {_GRANTEE}"  # noqa: S608 (fragmentos fijos)
        " FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace,"
        " aclexplode(c.relacl) acl"
        " WHERE n.nspname = 'public' AND acl.grantee <> c.relowner"
        " AND (acl.grantee = 0 OR pg_get_userbyid(acl.grantee) <> :app)",
    ),
    (
        "Funciones SECURITY DEFINER ejecutables por roles ajenos",
        f"SELECT DISTINCT p.proname || ' → ' || {_GRANTEE}"  # noqa: S608 (fragmentos fijos)
        " FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace,"
        " aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl"
        " WHERE n.nspname = 'public' AND p.prosecdef AND acl.privilege_type = 'EXECUTE'"
        " AND acl.grantee <> p.proowner"
        " AND (acl.grantee = 0 OR pg_get_userbyid(acl.grantee) <> :app)",
    ),
)


async def find_problems() -> list[str]:
    settings = get_settings()
    engine = create_async_engine(settings.MIGRATIONS_DATABASE_URL)
    problems: list[str] = []
    try:
        async with engine.connect() as conn:
            for title, sql in CHECKS:
                rows = (await conn.execute(text(sql), {"app": settings.DB_APP_ROLE})).scalars()
                problems += [f"{title}: {row}" for row in rows]
    finally:
        await engine.dispose()
    return problems


def main() -> None:
    problems = asyncio.run(find_problems())
    for problem in problems:
        print(f"✗ {problem}")
    if problems:
        sys.exit(1)
    print("✓ Roles, RLS y permisos de la base en orden.")


if __name__ == "__main__":
    main()
