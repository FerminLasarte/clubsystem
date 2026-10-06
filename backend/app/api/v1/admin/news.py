from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status

from app.api.deps import SessionDep, StaffContext, require
from app.domain.permissions import Permission
from app.schemas.common import Page, PageParams
from app.schemas.news import NewsCreate, NewsOut
from app.services.news import NewsService

router = APIRouter(prefix="/admin/news", tags=["Admin: novedades"])

Reader = Annotated[StaffContext, Depends(require(Permission.NEWS_READ))]
Writer = Annotated[StaffContext, Depends(require(Permission.NEWS_WRITE))]


@router.get("", response_model=Page[NewsOut])
async def list_news(
    params: Annotated[PageParams, Depends()], ctx: Reader, session: SessionDep
) -> Page[NewsOut]:
    return await NewsService(session, ctx).page(params)


@router.post("", status_code=status.HTTP_201_CREATED, response_model=NewsOut)
async def create_news(body: NewsCreate, ctx: Writer, session: SessionDep) -> NewsOut:
    return await NewsService(session, ctx).create(body)


@router.delete("/{news_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_news(news_id: UUID, ctx: Writer, session: SessionDep) -> None:
    await NewsService(session, ctx).delete(news_id)
