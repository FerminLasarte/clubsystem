"""
ClubSystem — Migración de usuarios legacy a ClubMembership
===========================================================
Busca todos los usuarios con `club_id` asignado en la tabla `users`
y les crea un registro en `club_memberships` con status=APPROVED,
a menos que ya exista uno.

Uso:
  # Dry-run (solo muestra qué haría, no escribe nada):
  python scripts/migrate_legacy_users.py

  # Aplicar cambios reales:
  python scripts/migrate_legacy_users.py --apply

Requisitos:
  - Ejecutar desde el directorio backend/ con el virtualenv activo.
  - Archivo .env en backend/ con DATABASE_URL configurado.

Seguridad:
  - Es IDEMPOTENTE: puede ejecutarse varias veces sin duplicar registros
    (la constraint uq_club_membership_user_club lo garantiza a nivel de DB,
    y la consulta previa lo garantiza a nivel de script).
  - No modifica registros existentes en club_memberships.
  - No toca el campo user.club_id (eso es una migración de esquema separada).
"""

import asyncio
import sys
from datetime import datetime, timezone
from pathlib import Path

# Asegurarse de que app/ sea importable desde scripts/
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select                           # noqa: E402
from sqlalchemy.ext.asyncio import (                   # noqa: E402
    AsyncSession,
    create_async_engine,
)
from sqlalchemy.orm import sessionmaker                 # noqa: E402

from app.core.config import settings                   # noqa: E402
from app.models.club_membership import ClubMembership  # noqa: E402
from app.models.user import User                       # noqa: E402


async def migrate(apply: bool) -> None:
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    AsyncSessionLocal: sessionmaker = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    async with AsyncSessionLocal() as db:
        # 1. Todos los usuarios con club_id asignado
        users_result = await db.execute(
            select(User).where(User.club_id.is_not(None))
        )
        legacy_users = users_result.scalars().all()

        if not legacy_users:
            print("No se encontraron usuarios legacy (club_id IS NOT NULL). Nada que migrar.")
            await engine.dispose()
            return

        print(f"Usuarios legacy encontrados: {len(legacy_users)}")
        print()

        now = datetime.now(timezone.utc)
        created = 0
        skipped = 0

        for user in legacy_users:
            # 2. Verificar si ya tiene un registro ClubMembership para ese club
            existing_result = await db.execute(
                select(ClubMembership).where(
                    ClubMembership.user_id == user.id,
                    ClubMembership.club_id == user.club_id,
                )
            )
            existing = existing_result.scalar_one_or_none()

            if existing is not None:
                print(
                    f"  SKIP  user_id={user.id} ({user.email})"
                    f" → ya tiene ClubMembership (status={existing.status})"
                )
                skipped += 1
                continue

            print(
                f"  {'CREATE' if apply else 'WOULD CREATE'}"
                f"  user_id={user.id} ({user.email})"
                f" → club_id={user.club_id} status=APPROVED"
            )

            if apply:
                new_membership = ClubMembership(
                    user_id=user.id,
                    club_id=user.club_id,
                    status="APPROVED",
                    approved_at=now,
                )
                db.add(new_membership)
                created += 1

        if apply:
            await db.commit()
            print()
            print(f"Migración completada: {created} creados, {skipped} omitidos.")
        else:
            print()
            print(
                f"Dry-run completado: {len(legacy_users) - skipped} se crearían,"
                f" {skipped} omitidos."
            )
            print("Ejecutá con --apply para aplicar los cambios.")

    await engine.dispose()


if __name__ == "__main__":
    apply_flag = "--apply" in sys.argv
    if not apply_flag:
        print("=== DRY-RUN (sin cambios) — pasá --apply para ejecutar ===")
        print()
    else:
        print("=== APLICANDO MIGRACIÓN ===")
        print()
    asyncio.run(migrate(apply=apply_flag))
