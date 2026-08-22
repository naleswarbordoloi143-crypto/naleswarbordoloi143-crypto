-- Add new columns for the crop disease report card feature
ALTER TABLE ai_analyses ADD COLUMN IF NOT EXISTS severity text DEFAULT '';
ALTER TABLE ai_analyses ADD COLUMN IF NOT EXISTS affected_parts text DEFAULT '';
ALTER TABLE ai_analyses ADD COLUMN IF NOT EXISTS organic_treatment text DEFAULT '';
ALTER TABLE ai_analyses ADD COLUMN IF NOT EXISTS chemical_treatment text DEFAULT '';
ALTER TABLE ai_analyses ADD COLUMN IF NOT EXISTS treatment_timeline text DEFAULT '';
ALTER TABLE ai_analyses ADD COLUMN IF NOT EXISTS estimated_impact text DEFAULT '';
ALTER TABLE ai_analyses ADD COLUMN IF NOT EXISTS disease_type text DEFAULT '';
