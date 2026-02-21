-- Add annotations column to drafts table
ALTER TABLE drafts ADD COLUMN IF NOT EXISTS annotations JSONB DEFAULT '[]'::jsonb;
