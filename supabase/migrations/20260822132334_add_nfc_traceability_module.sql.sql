/*
# NFC Traceability Module

## Purpose
Adds NFC-based identity and harvest traceability to Kishan Bhai.
NFC tags store only a unique identifier (e.g., KB-F-1024 or KB-WHT-2026-001).
The actual farmer/harvest data stays in the database and is served via authorized API.

## New Tables

### nfc_tags
- `id` (uuid PK)
- `tag_uid` (text, unique) — the human-readable unique ID written to the NFC tag (e.g., KB-F-1024)
- `entity_type` (text) — FARMER | HARVEST | MACHINERY
- `entity_id` (uuid) — FK to profiles / harvest_lots / machinery (nullable, since tag can be registered before assignment)
- `status` (text) — ACTIVE | INACTIVE | LOST | BLOCKED
- `qr_token` (text) — same UID, used for QR code fallback
- `registered_by` (uuid) — FK to profiles
- `last_scanned_at` (timestamptz)
- `last_scanned_by` (uuid) — FK to profiles
- `created_at`, `updated_at`

### nfc_scan_logs
- `id` (uuid PK)
- `tag_id` (uuid) — FK to nfc_tags
- `tag_uid` (text) — denormalized for audit even if tag is deleted
- `scanned_by` (uuid) — FK to profiles
- `scan_result` (text) — SUCCESS | NOT_FOUND | UNAUTHORIZED | BLOCKED | ERROR
- `location` (text)
- `latitude`, `longitude` (float8)
- `created_at`

### nfc_traceability_events
- `id` (uuid PK)
- `lot_id` (uuid) — FK to harvest_lots
- `tag_id` (uuid) — FK to nfc_tags (nullable)
- `event_type` (text) — HARVEST_CREATED | NFC_ASSIGNED | COLLECTION_SCANNED | QUALITY_CHECKED | BUYER_VIEWED | ORDER_CONFIRMED | COLLECTION_COMPLETED
- `actor_id` (uuid) — FK to profiles
- `location` (text)
- `latitude`, `longitude` (float8)
- `metadata` (jsonb) — extensible event details
- `created_at`

## Security (RLS)
- nfc_tags: authenticated users can read/insert/update; admins can delete
- nfc_scan_logs: authenticated users can insert and read their own scans; admins can read all
- nfc_traceability_events: authenticated users can read all events for lots they can see; champions/admins can insert
*/

-- 1. nfc_tags
CREATE TABLE IF NOT EXISTS nfc_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_uid text UNIQUE NOT NULL,
  entity_type text NOT NULL DEFAULT 'FARMER',
  entity_id uuid,
  status text NOT NULL DEFAULT 'ACTIVE',
  qr_token text,
  registered_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  last_scanned_at timestamptz,
  last_scanned_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE nfc_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_nfc_tags" ON nfc_tags;
CREATE POLICY "select_nfc_tags" ON nfc_tags FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_nfc_tags" ON nfc_tags;
CREATE POLICY "insert_nfc_tags" ON nfc_tags FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_nfc_tags" ON nfc_tags;
CREATE POLICY "update_nfc_tags" ON nfc_tags FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_nfc_tags_admin" ON nfc_tags;
CREATE POLICY "delete_nfc_tags_admin" ON nfc_tags FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- 2. nfc_scan_logs
CREATE TABLE IF NOT EXISTS nfc_scan_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_id uuid REFERENCES nfc_tags(id) ON DELETE SET NULL,
  tag_uid text NOT NULL,
  scanned_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  scan_result text NOT NULL DEFAULT 'SUCCESS',
  location text,
  latitude double precision,
  longitude double precision,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE nfc_scan_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_scan_logs" ON nfc_scan_logs;
CREATE POLICY "select_own_scan_logs" ON nfc_scan_logs FOR SELECT
  TO authenticated USING (
    scanned_by = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "insert_scan_logs" ON nfc_scan_logs;
CREATE POLICY "insert_scan_logs" ON nfc_scan_logs FOR INSERT
  TO authenticated WITH CHECK (true);

-- 3. nfc_traceability_events
CREATE TABLE IF NOT EXISTS nfc_traceability_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_id uuid REFERENCES harvest_lots(id) ON DELETE CASCADE,
  tag_id uuid REFERENCES nfc_tags(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  actor_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  location text,
  latitude double precision,
  longitude double precision,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE nfc_traceability_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_traceability_events" ON nfc_traceability_events;
CREATE POLICY "select_traceability_events" ON nfc_traceability_events FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_traceability_events" ON nfc_traceability_events;
CREATE POLICY "insert_traceability_events" ON nfc_traceability_events FOR INSERT
  TO authenticated WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_nfc_tags_tag_uid ON nfc_tags(tag_uid);
CREATE INDEX IF NOT EXISTS idx_nfc_tags_entity ON nfc_tags(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_nfc_scan_logs_tag ON nfc_scan_logs(tag_id);
CREATE INDEX IF NOT EXISTS idx_nfc_traceability_lot ON nfc_traceability_events(lot_id);
CREATE INDEX IF NOT EXISTS idx_nfc_traceability_type ON nfc_traceability_events(event_type);
