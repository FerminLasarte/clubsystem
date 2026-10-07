"""Perfil propio: lo edita solo el usuario (ningún club modifica la identidad de una persona)."""

from typing import Annotated

from fastapi import APIRouter, Request, status
from pydantic import AnyHttpUrl, BaseModel, StringConstraints

from app.api.deps import AuthDep, CurrentUser, SessionDep
from app.api.rate_limit import limit_user, limiter
from app.core.config import get_settings
from app.core.errors import BusinessRuleViolation
from app.core.security import hash_password, verify_password
from app.domain.enums import Gender
from app.schemas.auth import Dni, Name, UserOut
from app.schemas.common import Password
from app.services.auth import AuthService

router = APIRouter(prefix="/me", tags=["Perfil"])


class ProfileUpdate(BaseModel):
    first_name: Name | None = None
    last_name: Name | None = None
    phone: Annotated[str, StringConstraints(strip_whitespace=True, max_length=50)] | None = None
    dni: Dni | None = None
    gender: Gender | None = None
    avatar_url: AnyHttpUrl | None = None


class PasswordChange(BaseModel):
    current_password: Annotated[str, StringConstraints(min_length=1, max_length=72)]
    new_password: Password


@router.get("", response_model=UserOut)
async def get_profile(user: CurrentUser) -> UserOut:
    return UserOut.model_validate(user)


@router.patch("", response_model=UserOut)
@limiter.limit("20/hour")
async def update_profile(
    request: Request, body: ProfileUpdate, user: CurrentUser, session: SessionDep
) -> UserOut:
    changes = body.model_dump(exclude_unset=True, mode="json")
    for required in ("first_name", "last_name"):
        if required in changes and changes[required] is None:
            raise BusinessRuleViolation("Nombre y apellido son obligatorios.")
    for field, value in changes.items():
        setattr(user, field, value)
    await session.flush()
    return UserOut.model_validate(user)


@router.post("/password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(body: PasswordChange, auth: AuthDep, session: SessionDep) -> None:
    # Verifica la contraseña actual: sin límite, un access token robado permitiría adivinarla.
    limit_user("password_change", auth.user.id, get_settings().PASSWORD_CHANGE_USER_RATE_LIMIT)
    if not await verify_password(body.current_password, auth.user.password_hash):
        raise BusinessRuleViolation("La contraseña actual no es correcta.", code="wrong_password")
    auth.user.password_hash = await hash_password(body.new_password)
    # Cierra todas las sesiones, incluida la actual: el cliente vuelve a iniciar sesión.
    await AuthService(session).revoke_all(auth.user)
