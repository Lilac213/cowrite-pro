-- 创建检索资料表
CREATE TABLE retrieved_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES writing_sessions(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL, -- 'academic', 'news', 'web', 'user_library', 'personal'
  title TEXT NOT NULL,
  url TEXT,
  abstract TEXT,
  full_text TEXT,
  authors TEXT,
  year TEXT,
  citation_count INTEGER DEFAULT 0,
  published_at TIMESTAMPTZ,
  is_selected BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 创建索引
CREATE INDEX idx_retrieved_materials_session ON retrieved_materials(session_id);
CREATE INDEX idx_retrieved_materials_selected ON retrieved_materials(session_id, is_selected);
CREATE INDEX idx_retrieved_materials_source ON retrieved_materials(session_id, source_type);

-- RLS 策略
ALTER TABLE retrieved_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "用户可以查看自己会话的检索资料"
  ON retrieved_materials FOR SELECT
  USING (
    session_id IN (
      SELECT ws.id FROM writing_sessions ws
      JOIN projects p ON ws.project_id = p.id
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY "用户可以插入自己会话的检索资料"
  ON retrieved_materials FOR INSERT
  WITH CHECK (
    session_id IN (
      SELECT ws.id FROM writing_sessions ws
      JOIN projects p ON ws.project_id = p.id
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY "用户可以更新自己会话的检索资料"
  ON retrieved_materials FOR UPDATE
  USING (
    session_id IN (
      SELECT ws.id FROM writing_sessions ws
      JOIN projects p ON ws.project_id = p.id
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY "用户可以删除自己会话的检索资料"
  ON retrieved_materials FOR DELETE
  USING (
    session_id IN (
      SELECT ws.id FROM writing_sessions ws
      JOIN projects p ON ws.project_id = p.id
      WHERE p.user_id = auth.uid()
    )
  );