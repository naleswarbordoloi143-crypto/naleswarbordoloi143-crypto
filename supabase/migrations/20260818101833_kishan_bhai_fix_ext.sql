/* Move btree_gist into a dedicated extensions schema (not public) */
CREATE SCHEMA IF NOT EXISTS "extensions";
CREATE EXTENSION IF NOT EXISTS "btree_gist" SCHEMA "extensions";
