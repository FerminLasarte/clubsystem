"""Routers de la API v1. Cada uno define su prefijo."""

from app.api.v1 import auth, invitations, me
from app.api.v1.admin import club as admin_club
from app.api.v1.admin import courts as admin_courts
from app.api.v1.admin import reservations as admin_reservations
from app.api.v1.admin import staff as admin_staff
from app.api.v1.mobile import reservations as mobile_reservations

routers = [
    auth.router,
    me.router,
    invitations.router,
    admin_club.router,
    admin_staff.router,
    admin_courts.router,
    admin_reservations.router,
    mobile_reservations.router,
]
