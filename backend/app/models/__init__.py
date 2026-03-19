# Importar todos los modelos para que SQLAlchemy los registre en Base.metadata
from app.models.club import Club
from app.models.user import User
from app.models.club_staff import ClubStaff       # RBAC multi-tenant
from app.models.notification import Notification  # Notificaciones in-app
from app.models.court import Court
from app.models.reservation import Reservation
from app.models.expense import Expense
from app.models.stock import StockItem, StockMovement
