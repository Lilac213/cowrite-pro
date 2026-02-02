-- Add article-level argument structure to projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS article_argument_structure JSONB DEFAULT '{"core_thesis": "", "argument_blocks": []}'::jsonb;

-- Add paragraph-level reasoning structure to outlines
ALTER TABLE outlines ADD COLUMN IF NOT EXISTS reasoning_structure JSONB DEFAULT '{"main_argument": "", "sub_arguments": [], "conclusion": ""}'::jsonb;

-- Add evidence pool for outlines
ALTER TABLE outlines ADD COLUMN IF NOT EXISTS evidence_pool JSONB DEFAULT '[]'::jsonb;

-- Create reference library table
CREATE TABLE IF NOT EXISTS reference_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  source TEXT,
  source_url TEXT,
  keywords TEXT[],
  published_at TIMESTAMPTZ,
  saved_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add RLS policies for reference_library
ALTER TABLE reference_library ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own reference library" ON reference_library;
CREATE POLICY "Users can view their own reference library"
  ON reference_library FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert into their own reference library" ON reference_library;
CREATE POLICY "Users can insert into their own reference library"
  ON reference_library FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own reference library" ON reference_library;
CREATE POLICY "Users can update their own reference library"
  ON reference_library FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete from their own reference library" ON reference_library;
CREATE POLICY "Users can delete from their own reference library"
  ON reference_library FOR DELETE
  USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_reference_library_user_id ON reference_library(user_id);
CREATE INDEX IF NOT EXISTS idx_outlines_paragraph_order ON outlines(project_id, paragraph_order);