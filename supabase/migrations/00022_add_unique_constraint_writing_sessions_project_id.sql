-- 首先删除重复的 writing_sessions，只保留每个 project_id 最新的一条
WITH ranked_sessions AS (
  SELECT 
    id,
    project_id,
    ROW_NUMBER() OVER (PARTITION BY project_id ORDER BY created_at DESC) as rn
  FROM writing_sessions
)
DELETE FROM writing_sessions
WHERE id IN (
  SELECT id FROM ranked_sessions WHERE rn > 1
);

-- 添加唯一约束，确保每个 project 只有一个 writing_session
ALTER TABLE writing_sessions
ADD CONSTRAINT writing_sessions_project_id_unique UNIQUE (project_id);

-- 添加注释
COMMENT ON CONSTRAINT writing_sessions_project_id_unique ON writing_sessions IS '确保每个项目只有一个写作会话';