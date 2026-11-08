-- Waitlist sign-ups from the public site. One row per email address.
-- No IP address, user agent or cookie id is stored. See public/privacy/index.html.
CREATE TABLE waitlist (
  id             TEXT PRIMARY KEY,                -- uuid
  email          TEXT NOT NULL,                   -- as typed, trimmed
  email_norm     TEXT NOT NULL UNIQUE,            -- lower-cased, for de-duplication
  business_name  TEXT,
  business_type  TEXT NOT NULL CHECK (business_type IN ('laundromat', 'other')),
  city           TEXT,
  note           TEXT,
  utm_source     TEXT,
  utm_campaign   TEXT,                            -- the piece id when a sign-up came from a reel
  host           TEXT NOT NULL,                   -- which hostname took the sign-up
  created_at     TEXT NOT NULL,                   -- ISO 8601 UTC
  updated_at     TEXT NOT NULL,
  schema_version INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX waitlist_created_at ON waitlist (created_at);
