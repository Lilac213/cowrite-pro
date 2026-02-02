
-- Add new status for paragraph structure stage
ALTER TYPE project_status ADD VALUE IF NOT EXISTS 'paragraph_structure_confirmed' AFTER 'outline_confirmed';

-- Add paragraph_structures field to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS paragraph_structures JSONB;

COMMENT ON COLUMN projects.paragraph_structures IS 'Stores paragraph-level structures with reasoning, sub-claims, and supporting materials';
