# Lógica de Negocio: Multi-Tenant, Seguridad y RBAC

## 1. Integridad Multi-Tenant

- El sistema es un SaaS para múltiples clubes. NUNCA asumas que un usuario es un administrador global del sistema.
- Los usuarios base (identidad humana) solo existen en la tabla principal `users`.

## 2. Control de Acceso Basado en Roles (RBAC)

- Los permisos de un usuario dentro de un club se manejan mediante un Array de Enums (`roles: list[StaffRole]`) en la tabla `club_staff`.
- Toda consulta, endpoint, modificación a la base de datos o vista protegida del panel web DEBE validar y exigir el parámetro `club_id`.
- Se debe verificar que el `user_id` existe en la tabla `club_staff` para ese `club_id` específico.
- Se debe verificar la tenencia del rol específico (ej. `OWNER`, `RESERVATIONS_MANAGER`, `STOCK_MANAGER`) antes de autorizar cualquier acción crítica en la API o mostrar elementos sensibles en la UI.
