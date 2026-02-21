-- Add project_id column to research_insights table
-- This allows querying insights directly by project_id without joining writing_sessions
ALTER TABLE research_insights ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE CASCADE;

-- Backfill project_id from writing_sessions if possible
UPDATE research_insights ri
SET project_id = ws.project_id
FROM writing_sessions ws
WHERE ri.session_id = ws.id
AND ri.project_id IS NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_research_insights_project_id ON research_insights(project_id);

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload config';
