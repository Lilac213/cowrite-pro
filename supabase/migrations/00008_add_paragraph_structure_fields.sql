-- Add new fields to outlines table for paragraph-level argumentation
ALTER TABLE outlines 
ADD COLUMN IF NOT EXISTS paragraph_structure JSONB,
ADD COLUMN IF NOT EXISTS sub_claims_materials JSONB,
ADD COLUMN IF NOT EXISTS coherence_check JSONB,
ADD COLUMN IF NOT EXISTS final_text TEXT;