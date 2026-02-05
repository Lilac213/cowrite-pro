-- 添加 writing_summary 字段到 projects 表
ALTER TABLE projects ADD COLUMN IF NOT EXISTS writing_summary JSONB;