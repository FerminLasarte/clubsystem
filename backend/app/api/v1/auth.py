"""
Autenticación.

Panel web: tokens en cookies HttpOnly (access en `/`, refresh solo en `/api/v1/auth`).
App mobile: tokens en el body; la app los guarda en SecureStore y manda Bearer.
"""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Request, Response, status
from pydantic import BaseModel

from app.api.deps import (
    ACCESS_COOKIE,
    REFRESH_COOKIE,
    AuthDep,
    CurrentUser,
    SessionDep,
    StaffContext,
    get_staff_context,
)
from app.api.rate_limit import auth_limit, limiter
from app.core.config import get_settings
from app.core.errors import Forbidden, Unauthorized
from app.domain.permissions import permissions_for
from app.models import Club, ClubMembership, ClubStaff, User
from app.schemas.auth import (
    ForgotPasswordRequest,
    MembershipSummaryOut,
    MobileLoginRequest,
    MobileSessionOut,
    MobileTokensOut,
    RefreshRequest,
    RegisterRequest,
    ResetPasswordRequest,
    StaffClubOut,
    SwitchClubRequest,
    TokenRequest,
    UserOut,
    WebLoginRequest,
    WebSessionOut,
)
from app.services.auth import AuthService, ClientInfo, IssuedTokens

router = APIRouter(prefix="/auth", tags=["Auth"])

_AUTH_COOKIE_PATH = "/api/v1/auth"
SESSION_HINT_COOKIE = "cs_has_session"


# ── Helpers ─────────────────────────────────────────────────────────────────


def client_info(request: Request) -> ClientInfo:
    return ClientInfo(
        user_agent=request.headers.get("user-agent"),
        ip=request.client.host if request.client else None,
    )


def set_session_cookies(response: Response, *, access: str, refresh: str | None = None) -> None:
    settings = get_settings()
    response.set_cookie(
        ACCESS_COOKIE,
        access,
        max_age=settings.ACCESS_TOKEN_TTL_MINUTES * 60,
        path="/",
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite="lax",
        domain=settings.COOKIE_DOMAIN,
    )
    if refresh is not None:
        response.set_cookie(
            REFRESH_COOKIE,
            refresh,
            max_age=settings.REFRESH_TOKEN_TTL_DAYS * 86400,
            path=_AUTH_COOKIE_PATH,
            httponly=True,
            secure=settings.COOKIE_SECURE,
            samesite="lax",
            domain=settings.COOKIE_DOMAIN,
        )
        # Indicador sin secreto, legible por el proxy de Next para redirigir a /login.
        # La autorización real depende solo de las cookies HttpOnly.
        response.set_cookie(
            SESSION_HINT_COOKIE,
            "1",
            max_age=settings.REFRESH_TOKEN_TTL_DAYS * 86400,
            path="/",
            httponly=False,
            secure=settings.COOKIE_SECURE,
            samesite="lax",
            domain=settings.COOKIE_DOMAIN,
        )


def _clear_cookies(response: Response) -> None:
    domain = get_settings().COOKIE_DOMAIN
    response.delete_cookie(ACCESS_COOKIE, path="/", domain=domain)
    response.delete_cookie(REFRESH_COOKIE, path=_AUTH_COOKIE_PATH, domain=domain)
    response.delete_cookie(SESSION_HINT_COOKIE, path="/", domain=domain)


def _staff_club_out(staff: ClubStaff, club: Club) -> StaffClubOut:
    return StaffClubOut(
        club_id=club.id,
        name=club.name,
        slug=club.slug,
        logo_url=club.logo_url,
        primary_color=club.primary_color,
        accent_color=club.accent_color,
        timezone=club.timezone,
        roles=list(staff.roles),  # type: ignore[arg-type]
    )


async def build_web_session(
    service: AuthService, user: User, active_club_id: UUID
) -> WebSessionOut:
    clubs = await service.staff_clubs(user)
    active = next(((s, c) for s, c in clubs if c.id == active_club_id), None)
    if active is None:
        raise Forbidden("Ya no tenés acceso a este club.", code="staff_revoked")
    return WebSessionOut(
        user=UserOut.model_validate(user),
        clubs=[_staff_club_out(s, c) for s, c in clubs],
        active_club=_staff_club_out(*active),
        permissions=sorted(permissions_for(active[0].roles)),
    )


def _membership_out(membership: ClubMembership, club: Club) -> MembershipSummaryOut:
    return MembershipSummaryOut(
        membership_id=membership.id,
        club_id=club.id,
        club_name=club.name,
        club_slug=club.slug,
        logo_url=club.logo_url,
        primary_color=club.primary_color,
        status=membership.status,
        member_number=membership.member_number,
    )


async def _mobile_session(
    service: AuthService, user: User, tokens: IssuedTokens
) -> MobileSessionOut:
    return MobileSessionOut(
        access_token=tokens.access_token,
        refresh_token=tokens.refresh_token,
        user=UserOut.model_validate(user),
        memberships=[_membership_out(m, c) for m, c in await service.memberships(user)],
    )


# ── Panel web ───────────────────────────────────────────────────────────────


@router.post("/web/login", response_model=WebSessionOut)
@limiter.limit(auth_limit)
async def web_login(
    request: Request, response: Response, body: WebLoginRequest, session: SessionDep
) -> WebSessionOut:
    service = AuthService(session)
    user = await service.authenticate(body.email, body.password)
    clubs = await service.staff_clubs(user)
    if not clubs:
        raise Forbidden("Tu cuenta no tiene acceso a ningún panel de club.", code="no_staff")
    _, club = service.default_club(clubs)
    tokens = await service.start_session(
        user, client="web", club_id=club.id, info=client_info(request)
    )
    set_session_cookies(response, access=tokens.access_token, refresh=tokens.refresh_token)
    return await build_web_session(service, user, club.id)


@router.post("/web/refresh", response_model=WebSessionOut)
@limiter.limit(auth_limit)
async def web_refresh(request: Request, response: Response, session: SessionDep) -> WebSessionOut:
    raw = request.cookies.get(REFRESH_COOKIE)
    if not raw:
        raise Unauthorized("Necesitás iniciar sesión.")
    service = AuthService(session)
    user, tokens = await service.refresh(raw, client="web", info=client_info(request))
    club_id = tokens.session.active_club_id
    if club_id is None:
        clubs = await service.staff_clubs(user)
        if not clubs:
            _clear_cookies(response)
            raise Forbidden("Tu cuenta no tiene acceso a ningún panel de club.", code="no_staff")
        club_id = service.default_club(clubs)[1].id
        tokens.session.active_club_id = club_id
        tokens = IssuedTokens(
            access_token=await service.switch_club(user, tokens.session.id, club_id),
            refresh_token=tokens.refresh_token,
            session=tokens.session,
        )
    set_session_cookies(response, access=tokens.access_token, refresh=tokens.refresh_token)
    return await build_web_session(service, user, club_id)


@router.get("/web/session", response_model=WebSessionOut)
async def get_web_session(
    ctx: Annotated[StaffContext, Depends(get_staff_context)], session: SessionDep
) -> WebSessionOut:
    return await build_web_session(AuthService(session), ctx.user, ctx.club.id)


@router.post("/web/switch-club", response_model=WebSessionOut)
async def web_switch_club(
    body: SwitchClubRequest, auth: AuthDep, response: Response, session: SessionDep
) -> WebSessionOut:
    if auth.claims.client != "web":
        raise Forbidden("Solo disponible en el panel.")
    service = AuthService(session)
    access = await service.switch_club(auth.user, auth.claims.session_id, body.club_id)
    set_session_cookies(response, access=access)
    return await build_web_session(service, auth.user, body.club_id)


# ── App mobile ──────────────────────────────────────────────────────────────


@router.post("/mobile/login", response_model=MobileSessionOut)
@limiter.limit(auth_limit)
async def mobile_login(
    request: Request, body: MobileLoginRequest, session: SessionDep
) -> MobileSessionOut:
    service = AuthService(session)
    user = await service.authenticate(body.identifier, body.password)
    tokens = await service.start_session(user, client="mobile", info=client_info(request))
    return await _mobile_session(service, user, tokens)


@router.post("/mobile/refresh", response_model=MobileTokensOut)
@limiter.limit(auth_limit)
async def mobile_refresh(
    request: Request, body: RefreshRequest, session: SessionDep
) -> MobileTokensOut:
    _, tokens = await AuthService(session).refresh(
        body.refresh_token, client="mobile", info=client_info(request)
    )
    return MobileTokensOut(access_token=tokens.access_token, refresh_token=tokens.refresh_token)


class MobileProfileOut(BaseModel):
    user: UserOut
    memberships: list[MembershipSummaryOut]


@router.get("/mobile/session", response_model=MobileProfileOut)
async def mobile_session(user: CurrentUser, session: SessionDep) -> MobileProfileOut:
    service = AuthService(session)
    return MobileProfileOut(
        user=UserOut.model_validate(user),
        memberships=[_membership_out(m, c) for m, c in await service.memberships(user)],
    )


@router.post("/register", response_model=MobileSessionOut, status_code=status.HTTP_201_CREATED)
@limiter.limit(auth_limit)
async def register(
    request: Request, body: RegisterRequest, session: SessionDep
) -> MobileSessionOut:
    service = AuthService(session)
    user = await service.register(body)
    tokens = await service.start_session(user, client="mobile", info=client_info(request))
    return await _mobile_session(service, user, tokens)


# ── Comunes ─────────────────────────────────────────────────────────────────


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(auth: AuthDep, response: Response, session: SessionDep) -> None:
    await AuthService(session).revoke(auth.claims.session_id)
    _clear_cookies(response)


@router.post("/logout-all", status_code=status.HTTP_204_NO_CONTENT)
async def logout_all(user: CurrentUser, response: Response, session: SessionDep) -> None:
    await AuthService(session).revoke_all(user)
    _clear_cookies(response)


@router.post("/verify-email", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit(auth_limit)
async def verify_email(request: Request, body: TokenRequest, session: SessionDep) -> None:
    await AuthService(session).verify_email(body.token)


@router.post("/verify-email/resend", status_code=status.HTTP_202_ACCEPTED)
@limiter.limit(auth_limit)
async def resend_verification(request: Request, user: CurrentUser, session: SessionDep) -> None:
    await AuthService(session).send_verification(user)


@router.post("/password/forgot", status_code=status.HTTP_202_ACCEPTED)
@limiter.limit(auth_limit)
async def forgot_password(
    request: Request, body: ForgotPasswordRequest, session: SessionDep
) -> None:
    await AuthService(session).request_password_reset(body.email)


@router.post("/password/reset", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit(auth_limit)
async def reset_password(request: Request, body: ResetPasswordRequest, session: SessionDep) -> None:
    await AuthService(session).reset_password(body.token, body.new_password)
