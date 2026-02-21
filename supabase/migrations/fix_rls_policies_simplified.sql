-- Fix RLS policies for research_insights and research_gaps
-- Simplify policies to rely on writing_sessions visibility

-- 1. Ensure RLS is enabled on writing_sessions (just in case)
ALTER TABLE writing_sessions ENABLE ROW LEVEL SECURITY;

-- 2. research_insights policies

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view their own research insights" ON research_insights;
DROP POLICY IF EXISTS "Users can insert their own research insights" ON research_insights;
DROP POLICY IF EXISTS "Users can update their own research insights" ON research_insights;
DROP POLICY IF EXISTS "Users can delete their own research insights" ON research_insights;

-- Create simplified policies
CREATE POLICY "Users can view their own research insights"
  ON research_insights FOR SELECT
  USING (
    session_id IN (SELECT id FROM writing_sessions)
  );

CREATE POLICY "Users can insert their own research insights"
  ON research_insights FOR INSERT
  WITH CHECK (
    session_id IN (SELECT id FROM writing_sessions)
  );

CREATE POLICY "Users can update their own research insights"
  ON research_insights FOR UPDATE
  USING (
    session_id IN (SELECT id FROM writing_sessions)
  );

CREATE POLICY "Users can delete their own research insights"
  ON research_insights FOR DELETE
  USING (
    session_id IN (SELECT id FROM writing_sessions)
  );

-- 3. research_gaps policies

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own research gaps" ON research_gaps;
DROP POLICY IF EXISTS "Users can insert their own research gaps" ON research_gaps;
DROP POLICY IF EXISTS "Users can update their own research gaps" ON research_gaps;
DROP POLICY IF EXISTS "Users can delete their own research gaps" ON research_gaps;

-- Create simplified policies
CREATE POLICY "Users can view their own research gaps"
  ON research_gaps FOR SELECT
  USING (
    session_id IN (SELECT id FROM writing_sessions)
  );

CREATE POLICY "Users can insert their own research gaps"
  ON research_gaps FOR INSERT
  WITH CHECK (
    session_id IN (SELECT id FROM writing_sessions)
  );

CREATE POLICY "Users can update their own research gaps"
  ON research_gaps FOR UPDATE
  USING (
    session_id IN (SELECT id FROM writing_sessions)
  );

CREATE POLICY "Users can delete their own research gaps"
  ON research_gaps FOR DELETE
  USING (
    session_id IN (SELECT id FROM writing_sessions)
  );
