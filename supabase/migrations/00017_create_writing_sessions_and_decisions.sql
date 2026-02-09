-- 创建写作阶段枚举
CREATE TYPE writing_stage AS ENUM ('research', 'structure', 'paragraph', 'evidence', 'writing', 'completed');

-- 创建写作会话表
CREATE TABLE writing_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  current_stage writing_stage NOT NULL DEFAULT 'research',
  locked_core_thesis BOOLEAN NOT NULL DEFAULT FALSE,
  locked_structure BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 创建研究洞察表（存储 synthesis agent 的输出）
CREATE TABLE research_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES writing_sessions(id) ON DELETE CASCADE,
  insight_id TEXT NOT NULL, -- 来自 agent 的 insight ID
  category TEXT NOT NULL,
  insight TEXT NOT NULL,
  supporting_data JSONB,
  source_type TEXT,
  recommended_usage TEXT NOT NULL, -- direct | background | optional
  citability TEXT NOT NULL, -- direct | background | controversial
  limitations TEXT,
  user_decision TEXT NOT NULL DEFAULT 'pending', -- pending | must_use | background | excluded
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 创建研究矛盾/空白表
CREATE TABLE research_gaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES writing_sessions(id) ON DELETE CASCADE,
  gap_id TEXT NOT NULL,
  issue TEXT NOT NULL,
  description TEXT NOT NULL,
  user_decision TEXT NOT NULL DEFAULT 'pending', -- pending | respond | ignore
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 创建结构决策表
CREATE TABLE structure_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES writing_sessions(id) ON DELETE CASCADE,
  core_thesis_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  core_thesis_override TEXT,
  removed_blocks JSONB DEFAULT '[]'::jsonb,
  reordered_blocks JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 创建段落决策表
CREATE TABLE paragraph_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES writing_sessions(id) ON DELETE CASCADE,
  paragraph_id TEXT NOT NULL,
  action TEXT NOT NULL, -- accept | revise | skip
  revise_type TEXT, -- logic | experience | counter
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 创建证据决策表
CREATE TABLE evidence_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES writing_sessions(id) ON DELETE CASCADE,
  sub_claim_id TEXT NOT NULL,
  selected_evidence_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_writing_sessions_project ON writing_sessions(project_id);
CREATE INDEX idx_research_insights_session ON research_insights(session_id);
CREATE INDEX idx_research_gaps_session ON research_gaps(session_id);
CREATE INDEX idx_structure_decisions_session ON structure_decisions(session_id);
CREATE INDEX idx_paragraph_decisions_session ON paragraph_decisions(session_id);
CREATE INDEX idx_evidence_decisions_session ON evidence_decisions(session_id);

-- 添加 RLS 策略
ALTER TABLE writing_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_gaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE structure_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE paragraph_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_decisions ENABLE ROW LEVEL SECURITY;

-- writing_sessions 策略
CREATE POLICY "Users can view their own writing sessions"
  ON writing_sessions FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own writing sessions"
  ON writing_sessions FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own writing sessions"
  ON writing_sessions FOR UPDATE
  USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

-- research_insights 策略
CREATE POLICY "Users can view their own research insights"
  ON research_insights FOR SELECT
  USING (
    session_id IN (
      SELECT ws.id FROM writing_sessions ws
      JOIN projects p ON ws.project_id = p.id
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own research insights"
  ON research_insights FOR INSERT
  WITH CHECK (
    session_id IN (
      SELECT ws.id FROM writing_sessions ws
      JOIN projects p ON ws.project_id = p.id
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own research insights"
  ON research_insights FOR UPDATE
  USING (
    session_id IN (
      SELECT ws.id FROM writing_sessions ws
      JOIN projects p ON ws.project_id = p.id
      WHERE p.user_id = auth.uid()
    )
  );

-- research_gaps 策略（类似）
CREATE POLICY "Users can view their own research gaps"
  ON research_gaps FOR SELECT
  USING (
    session_id IN (
      SELECT ws.id FROM writing_sessions ws
      JOIN projects p ON ws.project_id = p.id
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own research gaps"
  ON research_gaps FOR INSERT
  WITH CHECK (
    session_id IN (
      SELECT ws.id FROM writing_sessions ws
      JOIN projects p ON ws.project_id = p.id
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own research gaps"
  ON research_gaps FOR UPDATE
  USING (
    session_id IN (
      SELECT ws.id FROM writing_sessions ws
      JOIN projects p ON ws.project_id = p.id
      WHERE p.user_id = auth.uid()
    )
  );

-- 其他决策表的策略（structure_decisions, paragraph_decisions, evidence_decisions）
CREATE POLICY "Users can manage their own structure decisions"
  ON structure_decisions FOR ALL
  USING (
    session_id IN (
      SELECT ws.id FROM writing_sessions ws
      JOIN projects p ON ws.project_id = p.id
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their own paragraph decisions"
  ON paragraph_decisions FOR ALL
  USING (
    session_id IN (
      SELECT ws.id FROM writing_sessions ws
      JOIN projects p ON ws.project_id = p.id
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their own evidence decisions"
  ON evidence_decisions FOR ALL
  USING (
    session_id IN (
      SELECT ws.id FROM writing_sessions ws
      JOIN projects p ON ws.project_id = p.id
      WHERE p.user_id = auth.uid()
    )
  );

COMMENT ON TABLE writing_sessions IS '写作会话表，跟踪写作流程状态';
COMMENT ON TABLE research_insights IS '研究洞察表，存储 synthesis agent 生成的洞察';
COMMENT ON TABLE research_gaps IS '研究矛盾/空白表';
COMMENT ON TABLE structure_decisions IS '结构决策表';
COMMENT ON TABLE paragraph_decisions IS '段落决策表';
COMMENT ON TABLE evidence_decisions IS '证据决策表';