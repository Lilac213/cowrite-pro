-- Add citations and guidance fields to drafts table for enhanced draft generation

-- Add citations field to store research material references
ALTER TABLE public.drafts ADD COLUMN IF NOT EXISTS citations jsonb DEFAULT '[]'::jsonb;

-- Add guidance field to store paragraph-level generation explanations and suggestions
ALTER TABLE public.drafts ADD COLUMN IF NOT EXISTS guidance jsonb DEFAULT '[]'::jsonb;

-- Add comment for citations field
COMMENT ON COLUMN public.drafts.citations IS 'Array of citation objects with material_id, position, and display info';

-- Add comment for guidance field
COMMENT ON COLUMN public.drafts.guidance IS 'Array of guidance objects for each paragraph with generation rationale and suggestions';
