-- Add new tables for agent-based architecture

-- 1. Requirements table (stores writing_brief)
CREATE TABLE IF NOT EXISTS requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  payload_jsonb JSONB NOT NULL,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_requirements_project ON requirements(project_id);

-- 2. Research sources table (stores retrieved materials with scores)
CREATE TABLE IF NOT EXISTS research_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  summary TEXT,
  source_url TEXT,
  source_type TEXT,
  credibility_score FLOAT DEFAULT 0.5,
  recency_score FLOAT DEFAULT 0.5,
  relevance_score FLOAT DEFAULT 0.5,
  token_length INTEGER,
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_research_sources_project ON research_sources(project_id);
CREATE INDEX idx_research_sources_relevance ON research_sources(relevance_score DESC);

-- 3. Synthesized insights table (stores research_pack)
CREATE TABLE IF NOT EXISTS synthesized_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  content TEXT NOT NULL,
  supporting_source_ids UUID[],
  evidence_strength TEXT CHECK (evidence_strength IN ('strong', 'medium', 'weak')),
  citability TEXT CHECK (citability IN ('direct', 'paraphrase', 'background')),
  user_decision TEXT DEFAULT 'pending' CHECK (user_decision IN ('confirmed', 'ignored', 'pending')),
  confidence_score FLOAT DEFAULT 0.5,
  risk_flag BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_synthesized_insights_project ON synthesized_insights(project_id);
CREATE INDEX idx_synthesized_insights_decision ON synthesized_insights(user_decision);

-- 4. Article structures table (stores argument_outline)
CREATE TABLE IF NOT EXISTS article_structures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  payload_jsonb JSONB NOT NULL,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_article_structures_project ON article_structures(project_id);

-- 5. Drafts table (stores structured draft with citations)
CREATE TABLE IF NOT EXISTS drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  payload_jsonb JSONB NOT NULL,
  version INTEGER DEFAULT 1,
  global_coherence_score FLOAT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_drafts_project ON drafts(project_id);

-- 6. Review reports table (stores review results)
CREATE TABLE IF NOT EXISTS review_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  payload_jsonb JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_review_reports_project ON review_reports(project_id);

-- 7. Agent logs table (critical for debugging and cost analysis)
CREATE TABLE IF NOT EXISTS agent_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  agent_name TEXT NOT NULL,
  input_payload_jsonb JSONB,
  output_payload_jsonb JSONB,
  token_usage INTEGER,
  latency_ms INTEGER,
  status TEXT CHECK (status IN ('success', 'error')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_agent_logs_project ON agent_logs(project_id);
CREATE INDEX idx_agent_logs_agent ON agent_logs(agent_name);
CREATE INDEX idx_agent_logs_created ON agent_logs(created_at DESC);

-- 8. Add is_completed flag to projects for points system
ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_completed BOOLEAN DEFAULT FALSE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS research_refreshed_count INTEGER DEFAULT 0;

-- 9. Add RLS policies for new tables
ALTER TABLE requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE synthesized_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_logs ENABLE ROW LEVEL SECURITY;

-- Policies for requirements
CREATE POLICY "Users can view their own requirements"
  ON requirements FOR SELECT
  USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert their own requirements"
  ON requirements FOR INSERT
  WITH CHECK (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

-- Policies for research_sources
CREATE POLICY "Users can view their own research sources"
  ON research_sources FOR SELECT
  USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert their own research sources"
  ON research_sources FOR INSERT
  WITH CHECK (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

-- Policies for synthesized_insights
CREATE POLICY "Users can view their own insights"
  ON synthesized_insights FOR SELECT
  USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert their own insights"
  ON synthesized_insights FOR INSERT
  WITH CHECK (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

CREATE POLICY "Users can update their own insights"
  ON synthesized_insights FOR UPDATE
  USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

-- Policies for article_structures
CREATE POLICY "Users can view their own structures"
  ON article_structures FOR SELECT
  USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert their own structures"
  ON article_structures FOR INSERT
  WITH CHECK (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

-- Policies for drafts
CREATE POLICY "Users can view their own drafts"
  ON drafts FOR SELECT
  USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert their own drafts"
  ON drafts FOR INSERT
  WITH CHECK (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

-- Policies for review_reports
CREATE POLICY "Users can view their own reviews"
  ON review_reports FOR SELECT
  USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert their own reviews"
  ON review_reports FOR INSERT
  WITH CHECK (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

-- Policies for agent_logs
CREATE POLICY "Users can view their own agent logs"
  ON agent_logs FOR SELECT
  USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

CREATE POLICY "Service role can insert agent logs"
  ON agent_logs FOR INSERT
  WITH CHECK (true);