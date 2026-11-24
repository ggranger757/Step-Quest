-- Step Quest push server (Cloudflare D1). Apply with:
--   npx wrangler d1 execute stepquest-push --remote --file=schema.sql

-- one row per device that turned notifications on
CREATE TABLE IF NOT EXISTS subs (
  id         TEXT PRIMARY KEY,          -- random id made by the device
  token_hash TEXT NOT NULL,             -- SHA-256 of the device's secret token (the token itself is never stored)
  endpoint   TEXT NOT NULL UNIQUE,      -- the browser's push service URL
  p256dh     TEXT NOT NULL,             -- the browser's public key (base64url)
  auth       TEXT NOT NULL,             -- the browser's auth secret (base64url)
  created    INTEGER NOT NULL,
  updated    INTEGER NOT NULL
);

-- the device's upcoming notifications; the device replaces the whole list whenever its missions change
CREATE TABLE IF NOT EXISTS jobs (
  sub_id TEXT NOT NULL,
  at     INTEGER NOT NULL,              -- when to send (ms since epoch)
  tag    TEXT NOT NULL,                 -- notifications with the same tag replace each other on the phone
  title  TEXT NOT NULL,
  body   TEXT NOT NULL,
  url    TEXT NOT NULL,
  ttl    INTEGER NOT NULL,              -- seconds a late notification is still worth sending
  PRIMARY KEY (sub_id, at, tag)
);
CREATE INDEX IF NOT EXISTS jobs_at ON jobs (at);

-- leaderboards (3.10.4): players who joined, and their steps per day (src/leaderboard.js)
CREATE TABLE IF NOT EXISTS lb_players (
  id         TEXT PRIMARY KEY,          -- random id made by the device
  token_hash TEXT NOT NULL,             -- SHA-256 of the device's secret token
  name       TEXT NOT NULL,             -- display name (3-16 characters)
  name_key   TEXT NOT NULL UNIQUE,      -- the name lowercased without spaces, _ or -: names are unique
  avatar     TEXT NOT NULL,
  skin       TEXT,
  level      INTEGER NOT NULL,
  total      INTEGER NOT NULL,          -- all-time steps
  created    INTEGER NOT NULL,
  updated    INTEGER NOT NULL,
  hidden     INTEGER NOT NULL DEFAULT 0 -- hidden by the admin
);
CREATE TABLE IF NOT EXISTS lb_days (
  id    TEXT NOT NULL,
  day   TEXT NOT NULL,                  -- YYYY-MM-DD, the player's own date
  steps INTEGER NOT NULL,
  PRIMARY KEY (id, day)
);
CREATE INDEX IF NOT EXISTS lb_days_day ON lb_days (day);
CREATE INDEX IF NOT EXISTS lb_players_total ON lb_players (total);
