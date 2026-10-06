"""
Alta de un club con su dueño. El panel no crea clubes: esto lo corre un operador.

El club se crea y su dueño recibe por email una invitación (vence en 7 días). Al aceptarla
elige su contraseña, o usa la de su cuenta si ya tenía una. Si el slug ya existe, solo se
renueva la invitación, por ejemplo porque venció.

Uso (en producción, desde `railway ssh` en el servicio de la API, donde está todo el entorno):
  python scripts/create_club.py --slug los-cardos --name "Los Cardos" \\
      --owner-email duena@example.com --sport padel --sport tennis --city Rosario

Usa MIGRATIONS_DATABASE_URL (rol dueño de la base) y el envío de emails configurado.
"""

import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from pydantic import ValidationError
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.config import get_settings
from app.core.errors import DomainError
from app.core.logging import configure_logging
from app.domain.enums import Sport
from app.schemas.clubs import ClubCreate
from app.services.clubs import create_club_with_owner
from app.services.email import wait_for_pending


async def main(data: ClubCreate) -> None:
    settings = get_settings()
    configure_logging(settings.LOG_LEVEL, json_output=settings.LOG_JSON)
    engine = create_async_engine(settings.MIGRATIONS_DATABASE_URL)
    try:
        async with async_sessionmaker(engine, expire_on_commit=False)() as session:
            async with session.begin():
                club, created = await create_club_with_owner(session, data)
            # El email sale en segundo plano: se espera antes de terminar el proceso.
            await wait_for_pending(grace_seconds=settings.EMAIL_TIMEOUT_SECONDS)
    finally:
        await engine.dispose()
    state = "creado" if created else "ya existía; se renovó la invitación del dueño"
    print(f"Club «{club.name}» ({club.slug}) {state}.")
    print("Invitación enviada. Si arriba hay un 'No se pudo enviar un email', revisá Resend.")


def parse_args() -> ClubCreate:
    parser = argparse.ArgumentParser(description="Alta de un club con la invitación a su dueño.")
    parser.add_argument("--slug", required=True, help="identificador en minúsculas: los-cardos")
    parser.add_argument("--name", required=True)
    parser.add_argument("--owner-email", required=True)
    parser.add_argument("--sport", action="append", default=[], choices=[s.value for s in Sport])
    parser.add_argument("--city")
    parser.add_argument("--timezone", help="por defecto America/Argentina/Buenos_Aires")
    args = parser.parse_args()
    try:
        return ClubCreate(
            slug=args.slug,
            name=args.name,
            owner_email=args.owner_email,
            sport_types=args.sport,
            city=args.city,
            timezone=args.timezone,
        )
    except ValidationError as exc:
        sys.exit(f"Datos inválidos:\n{exc}")


if __name__ == "__main__":
    data = parse_args()
    try:
        asyncio.run(main(data))
    except DomainError as exc:
        sys.exit(f"No se pudo: {exc}")
