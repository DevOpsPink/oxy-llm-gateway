-- ============================================================================
-- OXY ENGINE - SUPABASE COMPATIBILITY SHIM
-- ============================================================================
-- Provides the subset of Supabase's `auth`, `vault`, role chain, and
-- realtime publication that the main schema (`db/schema.sql`) depends on,
-- so the project can run against a plain PostgreSQL + PostgREST stack
-- without a hosted Supabase project.
--
-- Apply order:
--   1. supabase-compat.sql  (this file)
--   2. schema.sql            (existing golden schema)
--
-- DEV-grade caveats:
--   - vault secrets use pgcrypto AES, not pgsodium. Key comes from the
--     Postgres setting `app.vault_key` (set via SUPABASE_VAULT_KEY env).
--   - auth.users mirrors Supabase's column shape just well enough for the
--     schema's seed INSERT and FK references to work. There is no password
--     hashing, no email confirmation flow, no signup pipeline here — that
--     is the frontend auth migration's job (Phase 2c).
--   - auth.uid()/jwt()/role() read JWT claims from PostgREST's
--     `request.jwt.claims` setting, the same mechanism Supabase uses.
--
-- DO NOT USE THIS SHIM IN PRODUCTION WITHOUT REVIEW.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- Extensions (installed in the default schema so unqualified calls to
-- crypt(), gen_salt(), encrypt(), decrypt(), uuid_generate_v4() resolve via
-- search_path without forcing every caller to write `extensions.foo`).
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- The main schema still references `extensions` and `analytics` schemas
-- for grants and search_paths. Pre-create them as empty so those statements
-- succeed; CREATE EXTENSION IF NOT EXISTS with a SCHEMA clause is a no-op
-- when the extension is already installed in another schema.
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE SCHEMA IF NOT EXISTS analytics;

-- ----------------------------------------------------------------------------
-- Supabase-equivalent roles (PostgREST role chain)
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  CREATE ROLE anon NOLOGIN NOINHERIT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE ROLE authenticated NOLOGIN NOINHERIT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- The authenticator role is what PostgREST connects as. It must own the
-- three role grants so PostgREST can SET ROLE on a per-request basis.
-- Created without a password: db/03-authenticator-password.sh sets one,
-- generated on each install's first boot (or AUTHENTICATOR_PASSWORD).
DO $$ BEGIN
  CREATE ROLE authenticator NOINHERIT LOGIN;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

GRANT anon, authenticated, service_role TO authenticator;

-- ----------------------------------------------------------------------------
-- auth schema: Supabase-compatible users table + JWT-claim accessors
-- ----------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS auth;

-- Mirrors the FINAL state of Supabase's auth.users — i.e. the shape it has
-- after every GoTrue migration has been applied. We materialise it up front
-- so that (a) schema.sql's seed INSERT and FK references work immediately,
-- and (b) GoTrue's own migrations, which use IF NOT EXISTS / column-presence
-- checks throughout, all become safe no-ops when GoTrue boots later.
CREATE TABLE IF NOT EXISTS auth.users (
  instance_id                   UUID,
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aud                           VARCHAR(255),
  role                          VARCHAR(255),
  email                         VARCHAR(255) UNIQUE,
  encrypted_password            VARCHAR(255),
  email_confirmed_at            TIMESTAMPTZ,
  invited_at                    TIMESTAMPTZ,
  confirmation_token            VARCHAR(255) DEFAULT '',
  confirmation_sent_at          TIMESTAMPTZ,
  recovery_token                VARCHAR(255) DEFAULT '',
  recovery_sent_at              TIMESTAMPTZ,
  email_change_token_new        VARCHAR(255) DEFAULT '',
  email_change                  VARCHAR(255) DEFAULT '',
  email_change_sent_at          TIMESTAMPTZ,
  email_change_token_current    VARCHAR(255) DEFAULT '',
  email_change_confirm_status   SMALLINT DEFAULT 0
                                  CHECK (email_change_confirm_status >= 0
                                     AND email_change_confirm_status <= 2),
  last_sign_in_at               TIMESTAMPTZ,
  raw_app_meta_data             JSONB NOT NULL DEFAULT '{}',
  raw_user_meta_data            JSONB NOT NULL DEFAULT '{}',
  is_super_admin                BOOLEAN NOT NULL DEFAULT FALSE,
  is_sso_user                   BOOLEAN NOT NULL DEFAULT FALSE,
  is_anonymous                  BOOLEAN NOT NULL DEFAULT FALSE,
  phone                         TEXT UNIQUE,
  phone_confirmed_at            TIMESTAMPTZ,
  phone_change                  TEXT DEFAULT '',
  phone_change_token            VARCHAR(255) DEFAULT '',
  phone_change_sent_at          TIMESTAMPTZ,
  reauthentication_token        VARCHAR(255) DEFAULT '',
  reauthentication_sent_at      TIMESTAMPTZ,
  banned_until                  TIMESTAMPTZ,
  deleted_at                    TIMESTAMPTZ,
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Generated column matches the modern Supabase definition.
  confirmed_at                  TIMESTAMPTZ
                                  GENERATED ALWAYS AS (
                                    LEAST(email_confirmed_at, phone_confirmed_at)
                                  ) STORED
);

-- auth.uid(): UUID claim 'sub' from the request JWT, or NULL.
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS UUID
LANGUAGE SQL STABLE
AS $$
  SELECT NULLIF(
    current_setting('request.jwt.claims', true)::JSONB ->> 'sub',
    ''
  )::UUID
$$;

-- auth.jwt(): the full JWT claims payload as JSONB, or '{}'.
CREATE OR REPLACE FUNCTION auth.jwt()
RETURNS JSONB
LANGUAGE SQL STABLE
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claims', true), '')::JSONB,
    '{}'::JSONB
  )
$$;

-- auth.role(): 'role' claim from the request JWT.
CREATE OR REPLACE FUNCTION auth.role()
RETURNS TEXT
LANGUAGE SQL STABLE
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claims', true)::JSONB ->> 'role', ''),
    'anon'
  )
$$;

-- auth.email(): convenience reader for the 'email' claim.
CREATE OR REPLACE FUNCTION auth.email()
RETURNS TEXT
LANGUAGE SQL STABLE
AS $$
  SELECT NULLIF(current_setting('request.jwt.claims', true)::JSONB ->> 'email', '')
$$;

-- ----------------------------------------------------------------------------
-- vault schema: pgcrypto-backed secrets storage (DEV-grade)
-- ----------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS vault;

CREATE TABLE IF NOT EXISTS vault.secrets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT UNIQUE,
  description TEXT,
  secret      BYTEA NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Helper to fetch the configured AES key (Postgres setting set via env or
-- ALTER DATABASE). Falls back to a documented dev key if unset; this keeps
-- the local stack working out of the box and is intentionally weak.
CREATE OR REPLACE FUNCTION vault._key()
RETURNS BYTEA
LANGUAGE SQL STABLE
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('app.vault_key', true), ''),
    'oxy-local-vault-dev-key-please-override-in-prod'
  )::BYTEA
$$;

CREATE OR REPLACE FUNCTION vault.create_secret(
  new_secret  TEXT,
  new_name    TEXT DEFAULT NULL,
  description TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_id UUID := gen_random_uuid();
BEGIN
  INSERT INTO vault.secrets (id, name, description, secret)
  VALUES (
    v_id,
    new_name,
    description,
    encrypt(new_secret::BYTEA, vault._key(), 'aes')
  )
  ON CONFLICT (name) DO UPDATE
    SET secret      = EXCLUDED.secret,
        description = EXCLUDED.description,
        updated_at  = NOW()
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE VIEW vault.decrypted_secrets AS
SELECT
  id,
  name,
  description,
  convert_from(decrypt(secret, vault._key(), 'aes'), 'utf8') AS decrypted_secret,
  created_at,
  updated_at
FROM vault.secrets;

-- ----------------------------------------------------------------------------
-- Grants
-- ----------------------------------------------------------------------------
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA analytics  TO postgres, authenticated, service_role;
GRANT USAGE ON SCHEMA auth       TO postgres, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA vault      TO postgres, service_role;

GRANT ALL    ON TABLE  auth.users           TO service_role;
GRANT SELECT ON TABLE  auth.users           TO authenticated;

GRANT ALL    ON TABLE  vault.secrets        TO service_role;
GRANT SELECT ON       vault.decrypted_secrets TO service_role;
GRANT EXECUTE ON FUNCTION vault.create_secret(TEXT, TEXT, TEXT) TO service_role;

-- Allow auth helpers to be called by any role that PostgREST may switch to.
GRANT EXECUTE ON FUNCTION auth.uid()   TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.jwt()   TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.role()  TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.email() TO anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- supabase_realtime publication stub
-- ----------------------------------------------------------------------------
-- The main schema runs ALTER PUBLICATION supabase_realtime ADD TABLE ... for
-- a handful of tables (user_achievements, anomaly_alerts, notifications,
-- agent_sessions). On a vanilla Postgres this publication doesn't exist, so
-- we create an empty one here. Without an actual Realtime service consuming
-- the publication this is a no-op at runtime; the engine works without it.
DO $$ BEGIN
  CREATE PUBLICATION supabase_realtime;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMIT;
