# Importar todos los modelos para que SQLAlchemy los registre en Base.metadata
from app.models.club import Club
from app.models.user import User
from app.models.club_staff import ClubStaff       # RBAC multi-tenant
from app.models.notification import Notification  # Notificaciones in-app
from app.models.court import Court
from app.models.reservation import Reservation
from app.models.expense import Expense
from app.models.stock import StockItem, StockMovement
from app.models.payment import Payment
from app.models.fee import MembershipFee
from app.models.club_membership import ClubMembership  # Membresía multi-club (socio/visitante)
from app.models.club_news import ClubNews              # Novedades del club para socios
