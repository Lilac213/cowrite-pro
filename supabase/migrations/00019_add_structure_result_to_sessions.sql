-- 添加 structure_result 字段到 writing_sessions 表
ALTER TABLE writing_sessions 
ADD COLUMN IF NOT EXISTS structure_result JSONB;

COMMENT ON COLUMN writing_sessions.structure_result IS '存储文章结构生成结果，包含 core_thesis, argument_blocks 等';