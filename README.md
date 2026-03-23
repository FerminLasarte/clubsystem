# ClubSystem ⚡

Sistema de gestión integral para clubes deportivos. Backend en FastAPI, frontend web en Next.js, app mobile con Expo.

## Stack

| Capa       | Tecnología                     |
|------------|--------------------------------|
| Backend    | FastAPI · SQLAlchemy · asyncpg |
| Frontend   | Next.js 16 · Tailwind CSS     |
| Mobile     | Expo · React Native           |
| Base de datos | PostgreSQL                  |
| IA         | Gemini 2.0 Flash (detección de anomalías) |
| Monorepo   | pnpm · Turborepo              |

---

## Requisitos previos

- **Node.js** ≥ 18 + **pnpm** 9+
- **Python** 3.12 + **Poetry**
- **PostgreSQL** 14+

```bash
# Instalar pnpm si no lo tenés
npm install -g pnpm

# Instalar Poetry si no lo tenés
curl -sSL https://install.python-poetry.org | python3 -
```

---

## Setup inicial (primera vez)

### 1. Clonar y entrar al proyecto

```bash
cd ~/Documents/github
git clone https://github.com/TU_USUARIO/clubsystem.git
cd clubsystem
```

### 2. Instalar dependencias del frontend

```bash
pnpm install
```

### 3. Configurar el backend

```bash
cd backend

# Crear entorno virtual con Python 3.12
poetry config virtualenvs.in-project true
poetry env use python3.12
poetry install

# Volver a la raíz
cd ..
```

### 4. Crear la base de datos

```bash
# Crear la base de datos en PostgreSQL
createdb clubsystem_db

# Las tablas se crean automáticamente al iniciar el backend
```

### 5. Configurar variables de entorno

```bash
# Backend
cp backend/.env.example backend/.env
# Editar backend/.env con tus valores (DB, claves, API keys)

# Frontend
echo 'NEXT_PUBLIC_API_URL=http://localhost:8000' > apps/web/.env.local
```

**Variables necesarias en `backend/.env`:**

```env
APP_NAME="ClubSystem API"
DEBUG=True
SECRET_KEY="tu_clave_secreta_aqui"
JWT_SECRET_KEY="tu_clave_jwt_aqui"
DATABASE_URL="postgresql+asyncpg://TU_USUARIO@localhost:5432/clubsystem_db"
GEMINI_API_KEY="tu_api_key_de_gemini"   # Opcional, para IA
```

---

## Levantar el proyecto (día a día)

Necesitás **2 terminales**:

### Terminal 1 — Backend (FastAPI)

```bash
cd backend
poetry run python -m uvicorn app.main:app --reload --port 8000
```

> API disponible en http://localhost:8000
> Swagger UI en http://localhost:8000/docs

### Terminal 2 — Frontend (Next.js)

```bash
cd apps/web
pnpm dev
```

> Web disponible en http://localhost:3000

### Alternativa (Turborepo)

Si querés levantar todo junto desde la raíz:

```bash
pnpm dev
```

---

## Comandos útiles

```bash
# ── Backend ──────────────────────────────
cd backend
poetry run uvicorn app.main:app --reload     # Levantar servidor
poetry run python -m pytest                  # Correr tests
poetry add <paquete>                          # Instalar dependencia
poetry shell                                  # Activar venv

# ── Frontend ─────────────────────────────
cd apps/web
pnpm dev                                      # Dev server
pnpm build                                    # Build producción
pnpm lint                                     # Linter

# ── Base de datos ────────────────────────
psql -d clubsystem_db                         # Conectarse a la DB
# Si agregás columnas al modelo, corré:
psql -d clubsystem_db -c "ALTER TABLE tabla ADD COLUMN col TYPE;"

# ── Monorepo ─────────────────────────────
pnpm install                                  # Instalar deps
pnpm dev                                      # Dev (turbo)
pnpm build                                    # Build (turbo)
```

---

## Estructura del proyecto

```
clubsystem/
├── apps/
│   ├── web/              # Next.js frontend
│   │   ├── app/          # App router (pages)
│   │   └── components/   # Componentes reutilizables
│   └── mobile/           # Expo app (React Native)
├── backend/
│   ├── app/
│   │   ├── core/         # Config, DB, seguridad
│   │   ├── models/       # Modelos SQLAlchemy
│   │   ├── routers/      # Endpoints FastAPI
│   │   ├── services/     # Lógica de negocio
│   │   └── middleware/   # Middlewares (tenant, auth)
│   ├── pyproject.toml    # Dependencias Python
│   └── .env              # Variables de entorno (no commitear)
├── packages/
│   └── types/            # Tipos compartidos
├── turbo.json            # Configuración Turborepo
└── pnpm-workspace.yaml   # Workspace config
```

---

## Features principales

- 👥 **Socios** — Alta, gestión y búsqueda de miembros
- 💰 **Gastos** — Registro con detección automática de anomalías
- 🤖 **IA** — Explicaciones contextuales con Gemini para gastos sospechosos
- 📦 **Stock** — Control de inventario con movimientos
- 🏟️ **Reservas** — Gestión de canchas y turnos
- 📱 **Mobile** — App nativa con Expo (en desarrollo)

---

## Licencia

Proyecto privado — Todos los derechos reservados.
