/*
# Champion Certificate Verification System

## Overview
Adds a verification workflow for Village Champions. When someone signs up as a champion,
they must upload a certificate (e.g., agricultural extension officer certificate, KVK training
certificate, panchayat authorization letter). An AI edge function analyzes the certificate
image to determine if it appears genuine or fake. Only verified champions can advise farmers.

## Changes to existing tables

### profiles table — new columns:
- `champion_certificate_url` (text) — path to the uploaded certificate image in Supabase Storage
- `champion_verified` (boolean, default false) — whether the AI verified the certificate as genuine
- `champion_verification_status` (text, default 'not_submitted') — one of: 'not_submitted', 'pending', 'verified', 'rejected'
- `champion_verification_notes` (text) — AI-generated notes explaining the verification decision
- `champion_certificate_type` (text) — type of certificate identified by AI (e.g., 'KVK Training', 'Panchayat Authorization')
- `champion_verified_at` (timestamptz) — timestamp when verification was completed

## Storage
- Creates a private storage bucket `champion-certificates` for storing certificate images.
- Storage policies allow authenticated users to upload certificates to their own folder,
  read their own certificates, and admins to read all certificates.

## Security
- RLS already enabled on profiles; existing policies remain.
- Storage bucket is private (not publicly accessible).
- Certificate files are scoped per-user via path prefix.
*/

-- Add champion verification columns to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS champion_certificate_url text DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS champion_verified boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS champion_verification_status text DEFAULT 'not_submitted';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS champion_verification_notes text DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS champion_certificate_type text DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS champion_verified_at timestamptz;

-- Create storage bucket for champion certificates (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('champion-certificates', 'champion-certificates', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: users can upload/read their own certificates
DROP POLICY IF EXISTS "champion_cert_upload_own" ON storage.objects;
CREATE POLICY "champion_cert_upload_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'champion-certificates'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "champion_cert_read_own" ON storage.objects;
CREATE POLICY "champion_cert_read_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'champion-certificates'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Admins can read all certificates
DROP POLICY IF EXISTS "champion_cert_read_admin" ON storage.objects;
CREATE POLICY "champion_cert_read_admin" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'champion-certificates'
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'::user_role
    )
  );
