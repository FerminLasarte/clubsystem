"""
ClubSystem — Migración Multi-Tenant: usuarios legacy → ClubMembership + ClubStaff
==================================================================================
EJECUTAR ANTES de eliminar la columna `club_id` de la tabla `users`.

¿Qué hace?

  Paso 1 — ClubMembership (socios):
    Para cada User con club_id IS NOT NULL que no tenga un registro
    ClubMembership para ese club, crea uno con status=APPROVED.
    Esto garantiza que check_membership() devuelva is_member=True
    para todos los usuarios existentes.

  Paso 2 — ClubStaff (administradores):
    Para cada User con club_id IS NOT NULL que no tenga ningún registro
    ClubStaff activo, crea uno con roles=[OWNER].
    Esto sustituye la auto-migración que hacía POST /api/v1/auth/login
    al primer login de usuarios pre-RBAC, la cual dejará de existir.

    IMPORTANTE: este paso convierte en OWNER a todos los usuarios legacy
    que no hayan pasado antes por el flujo de login RBAC. Revisá los
    registros creados y eliminá los que no deban tener acceso de admin.

Uso:
  # Dry-run — solo muestra qué haría, no escribe nada:
  python scripts/migrate_users.py

  # Aplicar cambios:
  python scripts/migrate_users.py --apply

Requisitos:
  - Ejecutar desde el directorio backend/ con el virtualenv activo.
  - Archivo .env en backend/ con DATABASE_URL configurado.
  - Idempotente: se puede ejecutar varias veces sin duplicar registros.

Nota técnica:
  Las lecturas de `users.club_id` se hacen con SQL crudo (sqlalchemy.text)
  porque el campo ya fue eliminado del modelo ORM User. El script lee
  directamente la columna legacy desde la tabla de PostgreSQL sin depender
  de atributos del modelo Python.
"""

import asyncio
import sys
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select, text                     # noqa: E402
from sqlalchemy.ext.asyncio import (                   # noqa: E402
    AsyncSession,
    create_async_engine,
)
from sqlalchemy.orm import sessionmaker                 # noqa: E402

from app.core.config import settings                   # noqa: E402
from app.models.club_membership import ClubMembership  # noqa: E402
from app.models.club_staff import ClubStaff            # noqa: E402


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _fetch_legacy_users(db: AsyncSession) -> list:
    """
    Lee id, club_id y email de todos los usuarios con club_id IS NOT NULL
    usando SQL crudo, sin depender del modelo ORM User (que ya no tiene club_id).
    """
    result = await db.execute(
        text("SELECT id, club_id, email FROM users WHERE club_id IS NOT NULL")
    )
    return result.fetchall()


# ── Paso 1: ClubMembership ────────────────────────────────────────────────────

async def migrate_memberships(db: AsyncSession, apply: bool) -> tuple[int, int]:
    """Crea ClubMembership APPROVED para usuarios legacy. Retorna (creados, omitidos)."""
    legacy_users = await _fetch_legacy_users(db)

    now = datetime.now(timezone.utc)
    created = skipped = 0

    for row in legacy_users:
        user_id: UUID = row.id
        club_id: UUID = row.club_id
        email:   str  = row.email

        existing = await db.execute(
            select(ClubMembership).where(
                ClubMembership.user_id == user_id,
                ClubMembership.club_id == club_id,
            )
        )
        if existing.scalar_one_or_none() is not None:
            print(f"  [MEMBERSHIP SKIP]  {email} → ya tiene ClubMembership")
            skipped += 1
            continue

        print(f"  [MEMBERSHIP {'CREATE' if apply else 'WOULD CREATE'}]  {email} → club_id={club_id} APPROVED")
        if apply:
            db.add(ClubMembership(
                user_id=user_id,
                club_id=club_id,
                status="APPROVED",
                approved_at=now,
            ))
            created += 1

    return created, skipped


# ── Paso 2: ClubStaff ─────────────────────────────────────────────────────────

async def migrate_staff(db: AsyncSession, apply: bool) -> tuple[int, int]:
    """
    Crea ClubStaff OWNER para usuarios legacy sin ningún registro ClubStaff.
    Retorna (creados, omitidos).
    """
    legacy_users = await _fetch_legacy_users(db)

    created = skipped = 0

    for row in legacy_users:
        user_id: UUID = row.id
        club_id: UUID = row.club_id
        email:   str  = row.email

        existing = await db.execute(
            select(ClubStaff).where(ClubStaff.email == email)
        )
        if existing.scalar_one_or_none() is not None:
            print(f"  [STAFF SKIP]  {email} → ya tiene ClubStaff")
            skipped += 1
            continue

        print(f"  [STAFF {'CREATE' if apply else 'WOULD CREATE'}]  {email} → club_id={club_id} OWNER")
        if apply:
            db.add(ClubStaff(
                email=email,
                club_id=club_id,
                user_id=user_id,
                roles=["OWNER"],
                status="ACTIVE",
                is_active=True,
            ))
            created += 1

    return created, skipped


# ── Main ──────────────────────────────────────────────────────────────────────

async def run(apply: bool) -> None:
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    factory: sessionmaker = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    async with factory() as db:
        legacy_users = await _fetch_legacy_users(db)
        total_legacy = len(legacy_users)

        if total_legacy == 0:
            print("No hay usuarios legacy (club_id IS NOT NULL). Nada que migrar.")
            await engine.dispose()
            return

        print(f"Usuarios legacy encontrados: {total_legacy}")
        print()

        # ── Paso 1 ────────────────────────────────────────────────────────────
        print("── Paso 1: ClubMembership (socios) ──────────────────────────────")
        m_created, m_skipped = await migrate_memberships(db, apply)

        print()

        # ── Paso 2 ────────────────────────────────────────────────────────────
        print("── Paso 2: ClubStaff (administradores) ──────────────────────────")
        s_created, s_skipped = await migrate_staff(db, apply)

        if apply:
            await db.commit()

        print()
        print("── Resumen ──────────────────────────────────────────────────────")
        action = "creados" if apply else "se crearían"
        print(f"  ClubMembership: {m_created if apply else total_legacy - m_skipped} {action}, {m_skipped} omitidos")
        print(f"  ClubStaff:      {s_created if apply else total_legacy - s_skipped} {action}, {s_skipped} omitidos")

        if not apply:
            print()
            print("Ejecutá con --apply para aplicar los cambios.")
        else:
            print()
            print("Migración completada.")
            print()
            print("SIGUIENTE PASO: revisá los ClubStaff creados en el Paso 2 y")
            print("eliminá los que no deban tener acceso al panel de administración.")

    await engine.dispose()


if __name__ == "__main__":
    apply_flag = "--apply" in sys.argv
    print("=== ClubSystem: migración multi-tenant ===")
    print(f"=== Modo: {'APLICAR' if apply_flag else 'DRY-RUN (sin cambios)'} ===")
    print()
    asyncio.run(run(apply=apply_flag))
