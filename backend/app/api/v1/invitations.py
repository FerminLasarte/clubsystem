"""Aceptación de invitaciones al equipo de un club (link del email; no requiere sesión)."""

from fastapi import APIRouter, Request, Response

from app.api.deps import SessionDep
from app.api.rate_limit import auth_limit, limiter
from app.api.v1.auth import build_web_session, client_info, set_session_cookies
from app.schemas.auth import TokenRequest, WebSessionOut
from app.schemas.staff import AcceptInvitationRequest, InvitationPreviewOut
from app.services.auth import AuthService
from app.services.staff import accept_invitation, preview_invitation

router = APIRouter(prefix="/invitations", tags=["Invitaciones"])


# POST con el token en el body: en la URL quedaría registrado en logs de acceso y proxies.
@router.post("/preview", response_model=InvitationPreviewOut)
@limiter.limit(auth_limit)
async def preview(
    request: Request, body: TokenRequest, session: SessionDep
) -> InvitationPreviewOut:
    return await preview_invitation(session, body.token)


@router.post("/accept", response_model=WebSessionOut)
@limiter.limit(auth_limit)
async def accept(
    request: Request, response: Response, body: AcceptInvitationRequest, session: SessionDep
) -> WebSessionOut:
    user, club = await accept_invitation(session, body)
    service = AuthService(session)
    tokens = await service.start_session(
        user, client="web", club_id=club.id, info=client_info(request)
    )
    set_session_cookies(response, access=tokens.access_token, refresh=tokens.refresh_token)
    return await build_web_session(service, user, club.id)
