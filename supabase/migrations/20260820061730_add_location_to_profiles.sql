/*
# Add location columns to profiles

1. New Columns
- `latitude` (double precision, nullable) — user's current GPS latitude
- `longitude` (double precision, nullable) — user's current GPS longitude

2. Notes
- These columns store the user's last-known location captured at login.
- They are nullable so existing profiles are unaffected.
- No RLS changes needed — existing UPDATE policies already cover these columns.
*/

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision;
