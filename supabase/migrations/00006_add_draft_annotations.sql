-- Add annotations column to drafts table
ALTER TABLE public.drafts ADD COLUMN IF NOT EXISTS annotations jsonb;