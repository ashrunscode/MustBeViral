-- 2026-11-08: the site opens to local businesses in general, not only laundromats.
-- The kind of business becomes one of a list the Worker checks (src/waitlist.ts,
-- BUSINESS_TYPES), so the two-value CHECK goes. SQLite cannot drop a constraint
-- in place. Nothing is dropped here: the old table is renamed to waitlist_v1 and
-- every row is copied into the new table.
ALTER TABLE waitlist RENAME TO waitlist_v1;

CREATE TABLE waitlist (
  id             TEXT PRIMARY KEY,
  email          TEXT NOT NULL,
  email_norm     TEXT NOT NULL UNIQUE,
  business_name  TEXT,
  business_type  TEXT NOT NULL,
  city           TEXT,
  note           TEXT,
  utm_source     TEXT,
  utm_campaign   TEXT,
  host           TEXT NOT NULL,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  schema_version INTEGER NOT NULL DEFAULT 1
);

INSERT INTO waitlist
  (id, email, email_norm, business_name, business_type, city, note, utm_source, utm_campaign, host, created_at, updated_at, schema_version)
SELECT id, email, email_norm, business_name, business_type, city, note, utm_source, utm_campaign, host, created_at, updated_at, schema_version
FROM waitlist_v1;

CREATE INDEX waitlist_by_created_at ON waitlist (created_at);
