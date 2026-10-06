"""Routers de la API v1. El orden no importa: cada uno define su prefijo."""

from app.api.v1 import auth

routers = [auth.router]
