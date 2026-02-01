-- 创建项目历史表
CREATE TABLE IF NOT EXISTS project_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  stage TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_project_history_project_id ON project_history(project_id);
CREATE INDEX IF NOT EXISTS idx_project_history_stage ON project_history(stage);

-- 启用 RLS
ALTER TABLE project_history ENABLE ROW LEVEL SECURITY;

-- 创建 RLS 策略
CREATE POLICY "用户可以查看自己项目的历史"
  ON project_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_history.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "用户可以创建自己项目的历史"
  ON project_history FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_history.project_id
      AND projects.user_id = auth.uid()
    )
  );