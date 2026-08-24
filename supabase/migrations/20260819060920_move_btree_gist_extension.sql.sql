-- Move btree_gist extension out of the public schema into a dedicated extensions schema.
-- This follows Supabase security best practice: extensions should not live in `public`
-- because their objects become part of the public namespace and can clutter or expose
-- the API surface.

CREATE SCHEMA IF NOT EXISTS "extensions";

-- Relocate the extension and all its member objects to the extensions schema.
ALTER EXTENSION "btree_gist" SET SCHEMA "extensions";
