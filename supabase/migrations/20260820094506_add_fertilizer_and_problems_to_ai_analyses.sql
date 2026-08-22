-- Add fertilizer recommendation and all-problems columns to ai_analyses
ALTER TABLE ai_analyses
  ADD COLUMN IF NOT EXISTS fertilizer_name text DEFAULT '',
  ADD COLUMN IF NOT EXISTS fertilizer_type text DEFAULT '',
  ADD COLUMN IF NOT EXISTS fertilizer_quantity text DEFAULT '',
  ADD COLUMN IF NOT EXISTS fertilizer_frequency text DEFAULT '',
  ADD COLUMN IF NOT EXISTS fertilizer_application text DEFAULT '',
  ADD COLUMN IF NOT EXISTS all_problems text DEFAULT '';
