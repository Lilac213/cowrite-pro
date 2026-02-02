-- Add summary column to materials, reference_articles, and templates
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS summary text;
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS file_url text;
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS file_type text;

ALTER TABLE public.reference_articles ADD COLUMN IF NOT EXISTS summary text;
ALTER TABLE public.reference_articles ADD COLUMN IF NOT EXISTS file_url text;
ALTER TABLE public.reference_articles ADD COLUMN IF NOT EXISTS file_type text;

ALTER TABLE public.templates ADD COLUMN IF NOT EXISTS summary text;
ALTER TABLE public.templates ADD COLUMN IF NOT EXISTS tags text[];

-- Create index for template tags
CREATE INDEX IF NOT EXISTS idx_templates_tags ON templates USING gin(tags);