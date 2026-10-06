from typing import Annotated

from fastapi import APIRouter, Depends

from app.api.deps import CurrentUser, Member, SessionDep
from app.schemas.common import Page, PageParams
from app.schemas.news import MemberNewsOut
from app.services.news import club_feed, member_feed

router = APIRouter(prefix="/mobile", tags=["App: novedades"])


@router.get("/news", response_model=list[MemberNewsOut])
async def my_news(user: CurrentUser, session: SessionDep) -> list[MemberNewsOut]:
    return await member_feed(session, user)


@router.get("/clubs/{club_id}/news", response_model=Page[MemberNewsOut])
async def club_news(
    ctx: Member, params: Annotated[PageParams, Depends()], session: SessionDep
) -> Page[MemberNewsOut]:
    return await club_feed(session, ctx, params)
