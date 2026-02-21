-- Fix research_insights schema: Add missing columns
-- Run this in Supabase Dashboard -> SQL Editor

-- 1. Add missing columns to research_insights
ALTER TABLE research_insights 
ADD COLUMN IF NOT EXISTS insight_id TEXT,
ADD COLUMN IF NOT EXISTS category TEXT,
ADD COLUMN IF NOT EXISTS insight TEXT,
ADD COLUMN IF NOT EXISTS supporting_data JSONB,
ADD COLUMN IF NOT EXISTS source_type TEXT,
ADD COLUMN IF NOT EXISTS recommended_usage TEXT,
ADD COLUMN IF NOT EXISTS citability TEXT,
ADD COLUMN IF NOT EXISTS limitations TEXT,
ADD COLUMN IF NOT EXISTS user_decision TEXT DEFAULT 'pending';

-- 2. Add missing columns to research_gaps
ALTER TABLE research_gaps
ADD COLUMN IF NOT EXISTS gap_id TEXT,
ADD COLUMN IF NOT EXISTS issue TEXT,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS user_decision TEXT DEFAULT 'pending';

-- 3. Ensure RLS policies exist (optional, but good practice)
ALTER TABLE research_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_gaps ENABLE ROW LEVEL SECURITY;

-- Create policy if not exists (Postgres doesn't support IF NOT EXISTS for policies easily, so we use DO block)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'research_insights' AND policyname = 'Users can update their own research insights'
    ) THEN
        CREATE POLICY "Users can update their own research insights"
        ON research_insights FOR UPDATE
        USING (
            session_id IN (
                SELECT id FROM writing_sessions WHERE project_id IN (
                    SELECT id FROM projects WHERE user_id = auth.uid()
                )
            )
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'research_gaps' AND policyname = 'Users can update their own research gaps'
    ) THEN
        CREATE POLICY "Users can update their own research gaps"
        ON research_gaps FOR UPDATE
        USING (
            session_id IN (
                SELECT id FROM writing_sessions WHERE project_id IN (
                    SELECT id FROM projects WHERE user_id = auth.uid()
                )
            )
        );
    END IF;
END
$$;
