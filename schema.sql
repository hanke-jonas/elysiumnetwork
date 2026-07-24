-- Run once against the real D1 database:
--   npx wrangler d1 execute elysium-votes --remote --file=schema.sql
-- (functions/vote.js also creates these tables on first request if they're
-- missing, so this is a convenience for inspecting/seeding the DB directly.)

CREATE TABLE IF NOT EXISTS expansion_votes (
  country_id TEXT PRIMARY KEY,
  country_name TEXT NOT NULL,
  votes INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS expansion_voters (
  visitor_id TEXT NOT NULL,
  country_id TEXT NOT NULL,
  PRIMARY KEY (visitor_id, country_id)
);
