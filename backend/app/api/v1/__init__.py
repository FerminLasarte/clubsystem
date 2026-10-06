"""Routers de la API v1. Cada uno define su prefijo."""

from app.api.v1 import auth, invitations, me
from app.api.v1.admin import club as admin_club
from app.api.v1.admin import news as admin_news
from app.api.v1.admin import staff as admin_staff
from app.api.v1.admin import stock as admin_stock
from app.api.v1.mobile import news as mobile_news

routers = [
    auth.router,
    me.router,
    invitations.router,
    admin_club.router,
    admin_staff.router,
    admin_stock.router,
    admin_news.router,
    mobile_news.router,
]
