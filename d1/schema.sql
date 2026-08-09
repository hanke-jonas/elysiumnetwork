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
  status TEXT NOT NULL DEFAULT 'closed', -- 'open' | 'closed' | 'coming_up'
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

-- id (not slug) is the primary key, unlike branches, since a post's slug
-- should be renameable later without breaking the row it refers to.
CREATE TABLE IF NOT EXISTS blog_posts (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  excerpt TEXT,
  body_html TEXT NOT NULL DEFAULT '',
  cover_image TEXT,
  author_name TEXT,
  category TEXT,
  status TEXT NOT NULL DEFAULT 'draft', -- 'draft' | 'published'
  seo_title TEXT,
  seo_description TEXT,
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON blog_posts(status, published_at);

-- Downloadable resources (annual reports, toolkits, guides) — file_url
-- points at an /uploads/<key> path from the same R2-backed upload endpoint
-- team photos and blog covers use.
CREATE TABLE IF NOT EXISTS resources (
  id TEXT PRIMARY KEY,
  sort_order INTEGER NOT NULL DEFAULT 0,
  title TEXT NOT NULL,
  description TEXT,
  file_url TEXT NOT NULL,
  file_type TEXT, -- e.g. 'pdf' — mainly for the download-icon/label in the UI
  category TEXT,
  status TEXT NOT NULL DEFAULT 'draft', -- 'draft' | 'published'
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Real events with a date, distinct from the informal "Active Calls" list —
-- calls stay a static open/closed listing; events get a real date, location
-- and RSVP tracking against a public account.
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  body_html TEXT NOT NULL DEFAULT '',
  cover_image TEXT,
  location TEXT,
  branch_slug TEXT REFERENCES branches(slug),
  start_date TEXT NOT NULL, -- ISO date/datetime
  end_date TEXT,
  capacity INTEGER, -- NULL = unlimited
  status TEXT NOT NULL DEFAULT 'draft', -- 'draft' | 'published'
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status, start_date);

CREATE TABLE IF NOT EXISTS event_rsvps (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id),
  user_id TEXT NOT NULL REFERENCES public_users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(event_id, user_id)
);

-- A folder (R2 key prefix) an admin has put a password on, reachable by
-- anyone with the link and password at /shared/?f=<slug> — no account
-- needed. slug is the public, guessable-resistant identifier; prefix is
-- never exposed to the client until the password check passes.
CREATE TABLE IF NOT EXISTS protected_folders (
  slug TEXT PRIMARY KEY,
  prefix TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  label TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Monthly counters behind the admin Stats page, since R2's own free-tier
-- quotas (Class A "write" ops, Class B "read" ops) reset every month and
-- aren't otherwise queryable from a Worker binding (only Cloudflare's
-- account-level dashboard shows those). period is 'YYYY-MM'; metric is
-- 'upload' (a Class A op) or 'view' (a Class B op).
CREATE TABLE IF NOT EXISTS usage_counters (
  period TEXT NOT NULL,
  metric TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (period, metric)
);
