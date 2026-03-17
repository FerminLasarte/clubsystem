-- ============================================================
-- ClubSync — PostgreSQL Schema with Row-Level Security
-- Multi-tenant via club_id on every relevant table
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUM TYPES
-- ============================================================
CREATE TYPE user_role AS ENUM ('admin', 'staff', 'member');
CREATE TYPE sport_type AS ENUM ('tennis', 'padel', 'football', 'basketball', 'other');
CREATE TYPE court_surface AS ENUM ('clay', 'hard', 'grass', 'synthetic', 'indoor');
CREATE TYPE reservation_status AS ENUM ('pending', 'confirmed', 'cancelled', 'completed');
CREATE TYPE expense_category AS ENUM (
  'maintenance', 'utilities', 'salaries', 'equipment',
  'marketing', 'supplies', 'other'
);
CREATE TYPE anomaly_severity AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE stock_unit AS ENUM ('unit', 'box', 'kg', 'liter', 'pack');

-- ============================================================
-- CLUBS (Root tenant entity)
-- ============================================================
CREATE TABLE clubs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          VARCHAR(100) UNIQUE NOT NULL,    -- e.g. "club-atletico-tandil"
  name          VARCHAR(255) NOT NULL,
  sport_types   sport_type[] NOT NULL DEFAULT '{}',

  -- Branding (white-label customization)
  logo_url      TEXT,
  primary_color VARCHAR(7) DEFAULT '#111827',    -- hex
  accent_color  VARCHAR(7) DEFAULT '#3B82F6',
  font_family   VARCHAR(100) DEFAULT 'Inter',

  -- Contact
  address       TEXT,
  city          VARCHAR(100),
  country       VARCHAR(100) DEFAULT 'AR',
  phone         VARCHAR(50),
  email         VARCHAR(255),
  website       TEXT,

  -- Subscription
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  plan          VARCHAR(50) DEFAULT 'starter',   -- starter | pro | enterprise
  trial_ends_at TIMESTAMPTZ,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id         UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  role            user_role NOT NULL DEFAULT 'member',

  email           VARCHAR(255) NOT NULL,
  password_hash   TEXT NOT NULL,
  first_name      VARCHAR(100) NOT NULL,
  last_name       VARCHAR(100) NOT NULL,
  phone           VARCHAR(50),
  avatar_url      TEXT,
  dni             VARCHAR(20),                    -- national ID (AR context)
  birth_date      DATE,

  -- Member-specific
  member_number   VARCHAR(50),
  joined_at       DATE,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,

  -- Auth
  email_verified  BOOLEAN NOT NULL DEFAULT FALSE,
  last_login_at   TIMESTAMPTZ,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (club_id, email)
);

CREATE INDEX idx_users_club_id ON users(club_id);
CREATE INDEX idx_users_email ON users(email);

-- ============================================================
-- COURTS (Canchas)
-- ============================================================
CREATE TABLE courts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id      UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,

  name         VARCHAR(100) NOT NULL,             -- "Cancha 1", "Court A"
  sport        sport_type NOT NULL,
  surface      court_surface,
  is_indoor    BOOLEAN NOT NULL DEFAULT FALSE,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  capacity     INTEGER DEFAULT 2,                 -- max players
  hourly_rate  NUMERIC(10, 2) NOT NULL DEFAULT 0, -- ARS per hour
  description  TEXT,
  image_url    TEXT,

  -- Operating hours stored as JSON for flexibility
  -- {"mon": {"open": "08:00", "close": "22:00"}, ...}
  operating_hours JSONB DEFAULT '{}',

  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_courts_club_id ON courts(club_id);

-- ============================================================
-- RESERVATIONS
-- ============================================================
CREATE TABLE reservations (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id        UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  court_id       UUID NOT NULL REFERENCES courts(id),
  user_id        UUID NOT NULL REFERENCES users(id),

  status         reservation_status NOT NULL DEFAULT 'pending',
  starts_at      TIMESTAMPTZ NOT NULL,
  ends_at        TIMESTAMPTZ NOT NULL,
  duration_min   INTEGER GENERATED ALWAYS AS (
                   EXTRACT(EPOCH FROM (ends_at - starts_at)) / 60
                 ) STORED,

  total_price    NUMERIC(10, 2) NOT NULL DEFAULT 0,
  paid_amount    NUMERIC(10, 2) NOT NULL DEFAULT 0,
  is_paid        BOOLEAN GENERATED ALWAYS AS (paid_amount >= total_price) STORED,

  notes          TEXT,
  cancelled_at   TIMESTAMPTZ,
  cancelled_by   UUID REFERENCES users(id),

  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Prevent double-booking
  CONSTRAINT no_overlap EXCLUDE USING GIST (
    court_id WITH =,
    tstzrange(starts_at, ends_at, '[)') WITH &&
  ) WHERE (status != 'cancelled')
);

CREATE INDEX idx_reservations_club_id ON reservations(club_id);
CREATE INDEX idx_reservations_court_id ON reservations(court_id);
CREATE INDEX idx_reservations_user_id ON reservations(user_id);
CREATE INDEX idx_reservations_starts_at ON reservations(starts_at);

-- ============================================================
-- EXPENSES (Gastos)
-- ============================================================
CREATE TABLE expenses (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id        UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  created_by     UUID NOT NULL REFERENCES users(id),

  category       expense_category NOT NULL,
  description    VARCHAR(500) NOT NULL,
  amount         NUMERIC(12, 2) NOT NULL,
  currency       VARCHAR(3) DEFAULT 'ARS',
  expense_date   DATE NOT NULL,
  receipt_url    TEXT,                             -- S3 / cloud storage URL

  -- Vendor / supplier
  vendor_name    VARCHAR(255),
  vendor_tax_id  VARCHAR(50),

  -- AI anomaly detection (populated by background job)
  anomaly_score     FLOAT,                         -- 0.0 → 1.0
  anomaly_severity  anomaly_severity,
  anomaly_reason    TEXT,
  reviewed_by       UUID REFERENCES users(id),
  reviewed_at       TIMESTAMPTZ,

  tags           TEXT[] DEFAULT '{}',
  notes          TEXT,

  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_expenses_club_id ON expenses(club_id);
CREATE INDEX idx_expenses_category ON expenses(category);
CREATE INDEX idx_expenses_expense_date ON expenses(expense_date);
CREATE INDEX idx_expenses_anomaly_severity ON expenses(anomaly_severity)
  WHERE anomaly_severity IS NOT NULL;

-- ============================================================
-- STOCK (Inventario)
-- ============================================================
CREATE TABLE stock_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id         UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,

  sku             VARCHAR(100),
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  category        VARCHAR(100),                    -- "Raquetas", "Pelotas", etc.
  unit            stock_unit NOT NULL DEFAULT 'unit',
  quantity        NUMERIC(10, 2) NOT NULL DEFAULT 0,
  min_quantity    NUMERIC(10, 2) NOT NULL DEFAULT 0, -- reorder threshold
  unit_cost       NUMERIC(10, 2),
  unit_price      NUMERIC(10, 2),                  -- sale price (if applicable)
  supplier        VARCHAR(255),
  location        VARCHAR(100),                    -- physical location in club
  image_url       TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (club_id, sku)
);

CREATE INDEX idx_stock_items_club_id ON stock_items(club_id);
CREATE INDEX idx_stock_low ON stock_items(club_id) WHERE quantity <= min_quantity;

-- Stock movement log
CREATE TABLE stock_movements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id         UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  item_id         UUID NOT NULL REFERENCES stock_items(id),
  performed_by    UUID NOT NULL REFERENCES users(id),

  type            VARCHAR(20) NOT NULL CHECK (type IN ('in', 'out', 'adjustment')),
  quantity_delta  NUMERIC(10, 2) NOT NULL,         -- positive = in, negative = out
  quantity_before NUMERIC(10, 2) NOT NULL,
  quantity_after  NUMERIC(10, 2) NOT NULL,
  unit_cost       NUMERIC(10, 2),
  reason          TEXT,
  reference_id    UUID,                            -- e.g. expense_id, sale_id

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stock_movements_club_id ON stock_movements(club_id);
CREATE INDEX idx_stock_movements_item_id ON stock_movements(item_id);

-- ============================================================
-- ROW-LEVEL SECURITY
-- ============================================================

-- Enable RLS on all tenant tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE courts ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

-- App uses a single DB role "app_user" and sets current_club_id per session
CREATE ROLE app_user;

-- Policy: each table only shows rows matching current_setting club_id
CREATE POLICY tenant_isolation ON users
  USING (club_id = current_setting('app.current_club_id')::UUID);

CREATE POLICY tenant_isolation ON courts
  USING (club_id = current_setting('app.current_club_id')::UUID);

CREATE POLICY tenant_isolation ON reservations
  USING (club_id = current_setting('app.current_club_id')::UUID);

CREATE POLICY tenant_isolation ON expenses
  USING (club_id = current_setting('app.current_club_id')::UUID);

CREATE POLICY tenant_isolation ON stock_items
  USING (club_id = current_setting('app.current_club_id')::UUID);

CREATE POLICY tenant_isolation ON stock_movements
  USING (club_id = current_setting('app.current_club_id')::UUID);

-- Grant access to app_user role
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;

-- ============================================================
-- UPDATED_AT TRIGGER (utility)
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['clubs','users','courts','reservations','expenses','stock_items']
  LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_updated_at BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION set_updated_at()', tbl
    );
  END LOOP;
END $$;
