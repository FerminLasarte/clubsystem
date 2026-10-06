"""
Crea los dos roles de ClubSystem en un Postgres administrado (Supabase) usando el rol
administrador del proveedor (`postgres`), que no es superusuario.

  - DB_OWNER_ROLE (clubsystem_owner): dueño del esquema, con BYPASSRLS. Corre las
    migraciones y los scripts.
  - DB_APP_ROLE (clubsystem_app): la API. Sin ownership ni BYPASSRLS: sujeto a RLS.

Uso (desde backend/), con la URL del pooler en modo sesión (puerto 5432) del panel de Supabase,
postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres:

  ADMIN_DATABASE_URL='…' poetry run python scripts/provision_db.py --env-file .env.production

El script genera las contraseñas y las manda hasheadas (SCRAM-SHA-256), así no quedan en
claro en los logs del servidor. Escribe DATABASE_URL y MIGRATIONS_DATABASE_URL en
--env-file con permisos 600 y no las imprime.
Si los roles ya existen, se niega a seguir salvo con --rotate, que les cambia la contraseña
(después hay que actualizar las variables del servicio).
"""

import argparse
import asyncio
import base64
import hashlib
import hmac
import os
import re
import secrets
import sys
from pathlib import Path
from urllib.parse import quote, urlsplit

import asyncpg

_ROLE_NAME = re.compile(r"^[a-z_][a-z0-9_]{0,62}$")
_SCRAM_ITERATIONS = 4096


def _scram_sha256(password: str) -> str:
    """Verificador SCRAM-SHA-256 en el formato que guarda Postgres (`rolpassword`)."""
    salt = secrets.token_bytes(16)
    salted = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, _SCRAM_ITERATIONS)
    stored_key = hashlib.sha256(hmac.new(salted, b"Client Key", "sha256").digest()).digest()
    server_key = hmac.new(salted, b"Server Key", "sha256").digest()

    def b64(raw: bytes) -> str:
        return base64.b64encode(raw).decode()

    return f"SCRAM-SHA-256${_SCRAM_ITERATIONS}:{b64(salt)}${b64(stored_key)}:{b64(server_key)}"


def _role(env: str, default: str) -> str:
    name = os.environ.get(env, default)
    if not _ROLE_NAME.match(name):
        sys.exit(f"{env} inválido: {name!r}")
    return name


def _service_url(admin_url: str, role: str, password: str, ssl: str) -> str:
    """URL de la app/migraciones: mismo host, puerto y base que la del administrador."""
    parts = urlsplit(admin_url)
    admin_user = parts.username or ""
    # El pooler de Supabase identifica el proyecto por el sufijo del usuario: postgres.<ref>.
    suffix = admin_user[admin_user.index(".") :] if "." in admin_user else ""
    host = parts.hostname or ""
    port = f":{parts.port}" if parts.port else ""
    return (
        f"postgresql+asyncpg://{quote(role + suffix)}:{quote(password)}@{host}{port}"
        f"{parts.path}?ssl={ssl}"
    )


async def _provision(
    admin_url: str, owner: str, app: str, *, rotate: bool, ssl: str
) -> dict[str, str]:
    conn = await asyncpg.connect(admin_url.replace("+asyncpg", ""), ssl=ssl)
    try:
        me = await conn.fetchrow(
            "SELECT current_user AS name, rolsuper, rolcreaterole, rolbypassrls,"
            " current_database() AS db, current_setting('server_version') AS version"
            " FROM pg_roles WHERE rolname = current_user"
        )
        assert me is not None
        print(f"Conectado como {me['name']} a {me['db']} (Postgres {me['version']}).")
        if not (me["rolsuper"] or (me["rolcreaterole"] and me["rolbypassrls"])):
            sys.exit(
                f"{me['name']} necesita CREATEROLE y BYPASSRLS para crear el rol dueño"
                f" (createrole={me['rolcreaterole']}, bypassrls={me['rolbypassrls']})."
            )

        existing = {
            r["rolname"]
            for r in await conn.fetch(
                "SELECT rolname FROM pg_roles WHERE rolname = ANY($1::text[])", [owner, app]
            )
        }
        if existing and not rotate:
            sys.exit(
                f"Ya existen {', '.join(sorted(existing))}. Para cambiarles la contraseña,"
                " corré de nuevo con --rotate."
            )

        attributes = {
            owner: "LOGIN BYPASSRLS NOSUPERUSER NOCREATEDB NOCREATEROLE",
            app: "LOGIN NOBYPASSRLS NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT",
        }
        passwords: dict[str, str] = {}
        async with conn.transaction():
            for role, attrs in attributes.items():
                passwords[role] = secrets.token_urlsafe(32)
                verb = "ALTER" if role in existing else "CREATE"
                verifier = await conn.fetchval(
                    "SELECT quote_literal($1::text)", _scram_sha256(passwords[role])
                )
                await conn.execute(f"{verb} ROLE {role} WITH {attrs} PASSWORD {verifier}")

            db = await conn.fetchval("SELECT quote_ident(current_database())")
            await conn.execute(f"GRANT CONNECT ON DATABASE {db} TO {owner}, {app}")
            # El dueño crea tablas en public; la app solo las usa.
            await conn.execute(f"GRANT USAGE, CREATE ON SCHEMA public TO {owner}")
            await conn.execute(f"GRANT USAGE ON SCHEMA public TO {app}")
            # La migración inicial necesita btree_gist (EXCLUDE de reservas) en public.
            ext_schema = await conn.fetchval(
                "SELECT n.nspname FROM pg_extension e"
                " JOIN pg_namespace n ON n.oid = e.extnamespace WHERE e.extname = 'btree_gist'"
            )
            if ext_schema is None:
                await conn.execute("CREATE EXTENSION btree_gist WITH SCHEMA public")
            elif ext_schema != "public":
                sys.exit(f"btree_gist está instalada en {ext_schema!r}; tiene que estar en public.")
    finally:
        await conn.close()

    return {
        "DATABASE_URL": _service_url(admin_url, app, passwords[app], ssl),
        "MIGRATIONS_DATABASE_URL": _service_url(admin_url, owner, passwords[owner], ssl),
        "DB_APP_ROLE": app,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Crea los roles de ClubSystem en la base.")
    parser.add_argument("--env-file", type=Path, required=True, help="dónde escribir las URLs")
    parser.add_argument("--rotate", action="store_true", help="cambiar contraseñas existentes")
    parser.add_argument(
        "--ssl",
        choices=["require", "disable"],
        default="require",
        help="disable solo para un Postgres local sin SSL (por ejemplo, `supabase start`)",
    )
    args = parser.parse_args()

    admin_url = os.environ.get("ADMIN_DATABASE_URL")
    if not admin_url:
        sys.exit("Falta ADMIN_DATABASE_URL (rol postgres, pooler en modo sesión, puerto 5432).")
    if urlsplit(admin_url).port == 6543:
        sys.exit("Usá el pooler en modo sesión (puerto 5432), no el de transacciones (6543).")

    owner = _role("DB_OWNER_ROLE", "clubsystem_owner")
    app = _role("DB_APP_ROLE", "clubsystem_app")
    values = asyncio.run(_provision(admin_url, owner, app, rotate=args.rotate, ssl=args.ssl))

    args.env_file.touch(mode=0o600)
    args.env_file.chmod(0o600)  # por si ya existía con otros permisos
    args.env_file.write_text(
        "# Generado por scripts/provision_db.py. Contiene secretos: no se commitea.\n"
        + "".join(f"{key}={value}\n" for key, value in values.items())
    )
    print(f"Roles {owner} y {app} listos. URLs escritas en {args.env_file} (permisos 600).")


if __name__ == "__main__":
    main()
