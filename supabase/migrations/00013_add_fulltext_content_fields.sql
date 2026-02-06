-- Add columns for full-text content storage
ALTER TABLE knowledge_base 
ADD COLUMN IF NOT EXISTS content_status TEXT DEFAULT 'abstract_only',
ADD COLUMN IF NOT EXISTS extracted_content JSONB,
ADD COLUMN IF NOT EXISTS full_text TEXT;

-- Add index for content_status for better filtering
CREATE INDEX IF NOT EXISTS idx_knowledge_base_content_status ON knowledge_base(content_status);

-- Add comment for documentation
COMMENT ON COLUMN knowledge_base.content_status IS 'Content completeness status: full_text, abstract_only, insufficient_content, unavailable_fulltext';
COMMENT ON COLUMN knowledge_base.extracted_content IS 'Array of 3-8 extracted paragraphs from full text';
COMMENT ON COLUMN knowledge_base.full_text IS 'Complete extracted text content from URL';