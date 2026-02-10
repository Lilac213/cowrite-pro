
-- 添加 synthesis_result 字段到 writing_sessions 表
ALTER TABLE writing_sessions 
ADD COLUMN IF NOT EXISTS synthesis_result JSONB;

COMMENT ON COLUMN writing_sessions.synthesis_result IS '研究综合结果，包含 thought, input, synthesis 等信息';
