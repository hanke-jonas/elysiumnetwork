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
CREATE INDEX IF NOT EXISTS idx_call_interest_user ON call_interest(user_id);

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
CREATE INDEX IF NOT EXISTS idx_resources_status ON resources(status, published_at);

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
CREATE INDEX IF NOT EXISTS idx_event_rsvps_user ON event_rsvps(user_id);

-- Public, self-submitted alumni entries for DOTS-style cohort programmes.
-- `edition` is a plain label ('1', '2', ...) so future cohorts are just
-- more rows, not a new table or page. Submissions land as 'pending' and
-- only appear on the public gallery (and get their own individual
-- portfolio page at /dots/alumni/<slug>/) once staff flip them to
-- 'published' (same status pattern as blog_posts/resources/events) --
-- this is the moderation gate on an otherwise fully open, unauthenticated
-- form. `slug` is generated at submission time from the name plus a short
-- random suffix (collisions are never checked for -- the suffix makes
-- them practically impossible, same tradeoff as every randomId() used
-- elsewhere in this codebase).
CREATE TABLE IF NOT EXISTS dots_alumni (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  edition TEXT NOT NULL,
  name TEXT NOT NULL,
  pronouns TEXT, -- optional, shown next to the name
  current_role TEXT, -- "what are you up to now" -- job/study/project, shown under the name
  location TEXT, -- "based in" -- optional, distinct from `edition` (which branch/cohort)
  quote TEXT, -- a favourite quote or one line of advice for future participants
  bio TEXT NOT NULL,
  story TEXT, -- longer personal reflection, shown only on the individual page
  photo_url TEXT NOT NULL, -- main/cover photo, shown on the gallery card
  photos_json TEXT NOT NULL DEFAULT '[]', -- additional gallery photos for the individual page
  links_json TEXT NOT NULL DEFAULT '[]', -- [{label, url}, ...] optional social/contact links
  -- Free-form mini-page content: {id, type, ...fields}, type is one of
  -- 'heading' | 'paragraph' | 'image' | 'gallery' | 'button' | 'spacer'
  -- (same widget shape as the ugobongo visual editor). When non-empty,
  -- this fully replaces story/photos/links on the individual page --
  -- those stay as the simple fallback for anyone who never touches the
  -- block builder.
  blocks_json TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'published' | 'rejected'
  submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
  published_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_dots_alumni_status ON dots_alumni(status, edition);

-- A participant's proposed change to their own already-approved entry,
-- made by reusing their same access code (see
-- functions/api/dots-alumni/propose-edit.js). Never applied automatically
-- -- staff review and approve/reject in /admin/dots-edits/, same
-- moderation principle as the original submission. `proposed_json` holds
-- the complete proposed dots_alumni field set (not a partial diff) so
-- approval is a straight copy. `type` = 'delete' (from
-- functions/api/dots-alumni/request-deletion.js) means the participant
-- asked to have their whole entry removed instead -- proposed_json is just
-- '{}' in that case, and approving deletes the dots_alumni row rather than
-- updating it. Only one pending row per alumni_id at a time: submitting an
-- edit while a deletion is pending converts it back to 'edit' (changed
-- their mind), and vice versa -- see the upsert logic in both endpoints.
CREATE TABLE IF NOT EXISTS dots_alumni_edits (
  id TEXT PRIMARY KEY,
  alumni_id TEXT NOT NULL REFERENCES dots_alumni(id),
  type TEXT NOT NULL DEFAULT 'edit', -- 'edit' | 'delete'
  proposed_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected'
  submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_dots_alumni_edits_status ON dots_alumni_edits(status);

-- Invite-only gate for dots_alumni submissions: staff generate a code per
-- real participant (in /admin/dots-codes/) and share it directly, rather
-- than leaving the submission form open to anyone who finds the URL.
-- `used_at` is claimed atomically at submit time (UPDATE ... WHERE
-- used_at IS NULL) so a code can only ever back one submission.
CREATE TABLE IF NOT EXISTS dots_access_codes (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  edition TEXT NOT NULL,
  label TEXT, -- optional staff note (e.g. the participant's name), never shown publicly
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  used_at TEXT,
  dots_alumni_id TEXT REFERENCES dots_alumni(id)
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

-- Single-row config for the hidden /ugobongo joke page's mini admin panel
-- (/ugobongo-admin) -- id is always 1, there is only ever one row. Not
-- part of the real site's content model on purpose; kept fully separate.
CREATE TABLE IF NOT EXISTS ugobongo_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  title TEXT,
  subtitle TEXT,
  bio_html TEXT,
  images_json TEXT NOT NULL DEFAULT '[]',
  loading_ms INTEGER NOT NULL DEFAULT 12000,
  loading_messages_json TEXT NOT NULL DEFAULT '[]',
  spinner_image_url TEXT,
  spinner_speed_ms INTEGER NOT NULL DEFAULT 2000,
  -- Block-based page body driving the visual editor at /ugobongo-admin: a
  -- JSON array of {id, type, ...fields}, type is one of 'heading' |
  -- 'paragraph' | 'image' | 'gallery' | 'button' | 'spacer' | 'role' (a
  -- titled list section) | 'columns' (nests one level of the other simple
  -- types into a two-up layout) -- rendered in array order, reorderable by
  -- drag-and-drop on the canvas. NULL/empty means "use the built-in
  -- default bio", same fallback pattern as every other column here.
  blocks_json TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Persistent, multi-session chat history for the ugobongo-admin chat
-- assistant. Each session is a separate conversation the admin can switch
-- between; messages carry an optional image_url for attachments uploaded
-- alongside a chat message.
CREATE TABLE IF NOT EXISTS ugobongo_chat_sessions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT 'New chat',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ugobongo_chat_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES ugobongo_chat_sessions(id),
  role TEXT NOT NULL, -- 'user' | 'assistant'
  content TEXT NOT NULL,
  image_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ugobongo_chat_messages_session ON ugobongo_chat_messages(session_id, created_at);
