"""Routers de la API v1. Cada uno define su prefijo."""

from app.api.v1 import auth, invitations, me
from app.api.v1.admin import cash as admin_cash
from app.api.v1.admin import club as admin_club
from app.api.v1.admin import dashboard as admin_dashboard
from app.api.v1.admin import fees as admin_fees
from app.api.v1.admin import staff as admin_staff

routers = [
    auth.router,
    me.router,
    invitations.router,
    admin_club.router,
    admin_staff.router,
    admin_cash.router,
    admin_fees.router,
    admin_dashboard.router,
]
