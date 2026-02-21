-- Add structure_result column to writing_sessions
ALTER TABLE writing_sessions
ADD COLUMN IF NOT EXISTS structure_result JSONB;
