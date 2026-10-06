"""Routers de la API v1. Cada uno define su prefijo."""

from app.api.v1 import auth, invitations, me
from app.api.v1.admin import club as admin_club
from app.api.v1.admin import members as admin_members
from app.api.v1.admin import membership_plans as admin_membership_plans
from app.api.v1.admin import news as admin_news
from app.api.v1.admin import staff as admin_staff
from app.api.v1.admin import stock as admin_stock
from app.api.v1.mobile import memberships as mobile_memberships
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
    admin_membership_plans.router,
    admin_members.router,
    mobile_memberships.router,
]
