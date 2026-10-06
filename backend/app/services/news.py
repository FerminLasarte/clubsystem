"""Novedades que publica el club y que ven sus socios aprobados en la app."""

from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import Select, delete, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import BusinessRuleViolation, NotFound
from app.core.time import utcnow
from app.domain.enums import MembershipStatus
from app.models import Club, ClubMembership, ClubNews, User
from app.repositories.base import paginate
from app.schemas.common import Page, PageParams
from app.schemas.news import MemberNewsOut, NewsCreate, NewsOut
from app.services.context import MemberContext, StaffContext

_MEMBER_FEED_LIMIT = 30


def _news_out(news: ClubNews, author: User | None, now: datetime) -> NewsOut:
    return NewsOut(
        id=news.id,
        title=news.title,
        body=news.body,
        tag=news.tag,
        expires_at=news.expires_at,
        created_at=news.created_at,
        created_by_name=author.full_name if author else None,
        is_expired=news.expires_at is not None and news.expires_at <= now,
    )


class NewsService:
    def __init__(self, session: AsyncSession, ctx: StaffContext) -> None:
        self.db = session
        self.ctx = ctx

    async def page(self, params: PageParams) -> Page[NewsOut]:
        stmt: Select[*tuple[Any, ...]] = (
            select(ClubNews, User)
            .outerjoin(User, User.id == ClubNews.created_by_id)
            .where(ClubNews.club_id == self.ctx.club_id)
            .order_by(ClubNews.created_at.desc(), ClubNews.id.desc())
        )
        rows, total = await paginate(self.db, stmt, params)
        now = utcnow()
        return Page(
            items=[_news_out(news, author, now) for news, author in rows],
            total=total,
            page=params.page,
            page_size=params.page_size,
        )

    async def create(self, data: NewsCreate) -> NewsOut:
        now = utcnow()
        if data.expires_at is not None and data.expires_at <= now:
            raise BusinessRuleViolation("La fecha de vencimiento tiene que ser futura.")
        news = ClubNews(
            club_id=self.ctx.club_id,
            title=data.title,
            body=data.body,
            tag=data.tag,
            expires_at=data.expires_at,
            created_by_id=self.ctx.user_id,
        )
        self.db.add(news)
        await self.db.flush()
        await self.db.refresh(news, ["created_at"])
        return _news_out(news, self.ctx.user, now)

    async def delete(self, news_id: UUID) -> None:
        deleted = await self.db.execute(
            delete(ClubNews)
            .where(ClubNews.id == news_id, ClubNews.club_id == self.ctx.club_id)
            .returning(ClubNews.id)
        )
        if deleted.scalar_one_or_none() is None:
            raise NotFound("Novedad no encontrada.")


def _current_news(now: datetime) -> Select[ClubNews, Club]:
    return (
        select(ClubNews, Club)
        .join(Club, Club.id == ClubNews.club_id)
        .where(
            Club.is_active.is_(True),
            or_(ClubNews.expires_at.is_(None), ClubNews.expires_at > now),
        )
        .order_by(ClubNews.created_at.desc(), ClubNews.id.desc())
    )


def _member_news_out(news: ClubNews, club: Club) -> MemberNewsOut:
    return MemberNewsOut(
        id=news.id,
        club_id=club.id,
        club_name=club.name,
        club_color=club.primary_color,
        club_timezone=club.timezone,
        title=news.title,
        body=news.body,
        tag=news.tag,
        expires_at=news.expires_at,
        created_at=news.created_at,
    )


async def member_feed(session: AsyncSession, user: User) -> list[MemberNewsOut]:
    """Novedades vigentes de todos los clubes donde el usuario es socio aprobado."""
    my_clubs = select(ClubMembership.club_id).where(
        ClubMembership.user_id == user.id, ClubMembership.status == MembershipStatus.APPROVED
    )
    rows = await session.execute(
        _current_news(utcnow()).where(ClubNews.club_id.in_(my_clubs)).limit(_MEMBER_FEED_LIMIT)
    )
    return [_member_news_out(news, club) for news, club in rows]


async def club_feed(
    session: AsyncSession, ctx: MemberContext, params: PageParams
) -> Page[MemberNewsOut]:
    stmt: Select[*tuple[Any, ...]] = _current_news(utcnow()).where(ClubNews.club_id == ctx.club.id)
    rows, total = await paginate(session, stmt, params)
    return Page(
        items=[_member_news_out(news, club) for news, club in rows],
        total=total,
        page=params.page,
        page_size=params.page_size,
    )
