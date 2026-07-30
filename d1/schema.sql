-- Elysium+ Network — D1 schema
-- Two separate account tables (staff vs public) rather than one table with a
-- role flag: staff accounts are provisioned by other staff (never public
-- self-signup), public accounts are open self-signup — keeping them apart
-- means a bug in public signup can never accidentally create/escalate a
-- staff account.

CREATE TABLE IF NOT EXISTS staff_users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'editor', -- 'owner' | 'editor'
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS public_users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  email_verified INTEGER NOT NULL DEFAULT 0,
  newsletter_opt_in INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_login_at TEXT
);

-- Shared session table for both account kinds — one auth/session module,
-- one cookie mechanism, discriminated by user_type at read time.
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY, -- random token, this IS the cookie value
  user_type TEXT NOT NULL, -- 'staff' | 'public'
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- Email verification / password reset one-time tokens (public users only —
-- staff accounts are provisioned directly by another staff member, no email
-- verification loop needed).
CREATE TABLE IF NOT EXISTS public_user_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL, -- 'verify_email' | 'reset_password' | 'unsubscribe'
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  used_at TEXT
);

-- Content tables — the site's source of truth moves here from site.js.
-- Shape mirrors the existing hardcoded structures closely so the Eleventy
-- build-time data fetch (src/_data/*.js) can map rows back into the same
-- template-facing shape with minimal template changes.

CREATE TABLE IF NOT EXISTS branches (
  slug TEXT PRIMARY KEY,
  sort_order INTEGER NOT NULL DEFAULT 0,
  name TEXT NOT NULL,
  name_native TEXT,
  country TEXT NOT NULL,
  city TEXT NOT NULL,
  flag TEXT,
  accent TEXT,
  tz TEXT,
  lat TEXT,
  lon TEXT,
  iso_n3 TEXT,
  oid TEXT,
  type TEXT,
  status TEXT,
  tagline TEXT,
  about TEXT,
  focus_json TEXT NOT NULL DEFAULT '[]',   -- JSON array of strings
  people_json TEXT NOT NULL DEFAULT '[]',  -- JSON array of {name, role, email}
  email TEXT,
  phone TEXT,
  address TEXT,
  website TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS team_members (
  id TEXT PRIMARY KEY,
  sort_order INTEGER NOT NULL DEFAULT 0,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  image TEXT,
  focal_y TEXT DEFAULT '50%',
  bio TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS calls (
  id TEXT PRIMARY KEY,
  sort_order INTEGER NOT NULL DEFAULT 0,
  title TEXT NOT NULL,
  branch_slug TEXT REFERENCES branches(slug),
  is_open INTEGER NOT NULL DEFAULT 1,
  deadline_label TEXT,
  summary TEXT,
  link TEXT,
  link_label TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS faqs (
  id TEXT PRIMARY KEY,
  sort_order INTEGER NOT NULL DEFAULT 0,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- A public user expressing interest in / applying to a call. Kept separate
-- from `calls` since it's a many-to-one join with its own lifecycle.
CREATE TABLE IF NOT EXISTS call_interest (
  id TEXT PRIMARY KEY,
  call_id TEXT NOT NULL REFERENCES calls(id),
  user_id TEXT NOT NULL REFERENCES public_users(id),
  message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(call_id, user_id) -- one expression of interest per user per call
);

-- Newsletter subscribers are intentionally NOT the same table as
-- public_users: subscribing shouldn't require creating an account, and a
-- logged-in user's newsletter_opt_in flag on public_users is just a
-- convenience that keeps this table in sync, not a replacement for it.
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'confirmed' | 'unsubscribed'
  -- Single token used for both the confirm and unsubscribe links sent by
  -- email — no separate public account or login needed to manage a
  -- newsletter-only subscription, so it can't reuse public_user_tokens.
  token TEXT UNIQUE NOT NULL,
  public_user_id TEXT REFERENCES public_users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  confirmed_at TEXT,
  unsubscribed_at TEXT
);

CREATE TABLE IF NOT EXISTS newsletter_campaigns (
  id TEXT PRIMARY KEY,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft', -- 'draft' | 'sending' | 'sent'
  created_by TEXT REFERENCES staff_users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  sent_at TEXT,
  recipient_count INTEGER NOT NULL DEFAULT 0
);
