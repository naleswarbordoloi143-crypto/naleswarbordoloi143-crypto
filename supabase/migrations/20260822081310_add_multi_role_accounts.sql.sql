/*
# Multi-Role Account System

## Overview
Previously each user had exactly one role (farmer, champion, buyer, or admin) chosen at signup.
This migration adds support for multiple roles per account. One email can now have farmer,
champion, and buyer roles simultaneously. The user switches between them in the app header.

## Changes to profiles table
- `roles` (text[]) — array of roles the user has. Defaults to ['farmer'].
  This replaces the single `role` column as the source of truth for what a user can do.
- `active_role` (text) — the currently selected role for the session. Defaults to 'farmer'.
  Drives which dashboard and nav items are shown.

The existing `role` column is kept for backward compatibility (admin dashboard, edge functions
that reference it). It will be kept in sync with `active_role`.

## Security
- No changes to existing RLS policies.
- The `roles` and `active_role` columns are user-editable through normal profile update policies,
  same as other profile fields like village or phone.
*/

-- Add roles array and active_role columns
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS roles text[] DEFAULT ARRAY['farmer']::text[];
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS active_role text DEFAULT 'farmer';

-- Backfill: set roles and active_role from existing role column for all existing profiles
UPDATE profiles
SET roles = ARRAY[role],
    active_role = role
WHERE roles = ARRAY['farmer']::text[] AND active_role = 'farmer' AND role IS NOT NULL AND role <> 'farmer';

-- Add index for querying by active_role
CREATE INDEX IF NOT EXISTS idx_profiles_active_role ON profiles(active_role);
