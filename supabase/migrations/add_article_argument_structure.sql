-- Add article_argument_structure column to projects table
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS article_argument_structure JSONB DEFAULT NULL;

-- Notify Supabase to refresh schema cache (usually happens automatically on DDL, but good to know)
NOTIFY pgrst, 'reload schema';
