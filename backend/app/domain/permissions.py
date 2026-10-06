"""
Matriz de permisos del panel: qué puede hacer cada rol de staff.
Es la única fuente de verdad; los endpoints exigen permisos, no roles.
"""

from enum import StrEnum

from app.domain.enums import StaffRole


class Permission(StrEnum):
    DASHBOARD_OPERATIONS = "dashboard:operations"
    DASHBOARD_FINANCE = "dashboard:finance"
    COURTS_READ = "courts:read"
    COURTS_WRITE = "courts:write"
    RESERVATIONS_READ = "reservations:read"
    RESERVATIONS_WRITE = "reservations:write"
    MEMBERS_READ = "members:read"
    MEMBERS_WRITE = "members:write"
    MEMBERS_EXPORT = "members:export"
    PLANS_WRITE = "plans:write"
    STOCK_READ = "stock:read"
    STOCK_WRITE = "stock:write"
    EXPENSES_READ = "expenses:read"
    EXPENSES_WRITE = "expenses:write"
    CASH_READ = "cash:read"
    CASH_WRITE = "cash:write"
    FEES_READ = "fees:read"
    FEES_WRITE = "fees:write"
    NEWS_READ = "news:read"
    NEWS_WRITE = "news:write"
    SETTINGS_READ = "settings:read"
    SETTINGS_WRITE = "settings:write"
    STAFF_MANAGE = "staff:manage"


ROLE_PERMISSIONS: dict[StaffRole, frozenset[Permission]] = {
    StaffRole.OWNER: frozenset(Permission),
    StaffRole.RESERVATIONS_MANAGER: frozenset(
        {
            Permission.DASHBOARD_OPERATIONS,
            Permission.COURTS_READ,
            Permission.RESERVATIONS_READ,
            Permission.RESERVATIONS_WRITE,
            Permission.MEMBERS_READ,
            Permission.MEMBERS_WRITE,
            Permission.NEWS_READ,
        }
    ),
    StaffRole.STOCK_MANAGER: frozenset(
        {Permission.DASHBOARD_OPERATIONS, Permission.STOCK_READ, Permission.STOCK_WRITE}
    ),
}

# Roles que un OWNER puede asignar al invitar. OWNER solo se asigna por script.
INVITABLE_ROLES = frozenset({StaffRole.RESERVATIONS_MANAGER, StaffRole.STOCK_MANAGER})


def permissions_for(roles: list[str] | list[StaffRole]) -> frozenset[Permission]:
    result: set[Permission] = set()
    for role in roles:
        result |= ROLE_PERMISSIONS.get(StaffRole(role), frozenset())
    return frozenset(result)
