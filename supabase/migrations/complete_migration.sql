-- ============================================
-- 完整数据库迁移脚本
-- 用于新 Supabase 实例
-- ============================================

-- 创建用户角色枚举
CREATE TYPE public.user_role AS ENUM ('user', 'admin');

-- 创建项目状态枚举
CREATE TYPE public.project_status AS ENUM (
  'init',
  'confirm_brief',
  'knowledge_selected',
  'outline_confirmed',
  'drafting',
  'review_pass_1',
  'review_pass_2',
  'review_pass_3',
  'completed'
);

-- 创建用户配置表
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  role user_role NOT NULL DEFAULT 'user',
  llm_api_key text,
  llm_provider text,
  search_api_key text,
  search_provider text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 创建项目表
CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  status project_status NOT NULL DEFAULT 'init',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  is_completed BOOLEAN DEFAULT FALSE,
  research_refreshed_count INTEGER DEFAULT 0
);

-- 创建需求文档表
CREATE TABLE public.briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  topic text NOT NULL,
  format_template text,
  output_format text,
  requirements jsonb,
  confirmed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 创建知识库表
CREATE TABLE public.knowledge_base (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL,
  source text NOT NULL,
  source_url text,
  published_at timestamptz,
  collected_at timestamptz NOT NULL DEFAULT now(),
  next_update_suggestion text,
  selected boolean NOT NULL DEFAULT false,
  keywords text[],
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 创建大纲表
CREATE TABLE public.outlines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  paragraph_order int NOT NULL,
  summary text NOT NULL,
  selected boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 创建参考文章表
CREATE TABLE public.reference_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  title text NOT NULL,
  content text NOT NULL,
  source_type text,
  keywords text[],
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 创建个人素材表
CREATE TABLE public.materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  title text NOT NULL,
  material_type text NOT NULL CHECK (material_type IN ('experience', 'opinion', 'case')),
  content text NOT NULL,
  keywords text[],
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 创建草稿表（旧版）
CREATE TABLE public.drafts_old (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  content text NOT NULL,
  version int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 创建审校表
CREATE TABLE public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  review_round int NOT NULL CHECK (review_round IN (1, 2, 3)),
  issues jsonb,
  completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 创建模板表
CREATE TABLE public.templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  content text NOT NULL,
  format text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================
-- Agent 架构相关表
-- ============================================

-- 1. Requirements table (stores writing_brief)
CREATE TABLE IF NOT EXISTS requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  payload_jsonb JSONB NOT NULL,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Research sources table
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

-- 3. Synthesized insights table
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

-- 4. Article structures table
CREATE TABLE IF NOT EXISTS article_structures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  payload_jsonb JSONB NOT NULL,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Drafts table (新版，存储结构化草稿)
CREATE TABLE IF NOT EXISTS drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  payload_jsonb JSONB NOT NULL,
  version INTEGER DEFAULT 1,
  global_coherence_score FLOAT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Review reports table
CREATE TABLE IF NOT EXISTS review_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  payload_jsonb JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Agent logs table
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

-- 8. System config table
CREATE TABLE IF NOT EXISTS system_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key TEXT UNIQUE NOT NULL,
  config_value TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 索引
-- ============================================

CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_briefs_project_id ON briefs(project_id);
CREATE INDEX idx_knowledge_base_project_id ON knowledge_base(project_id);
CREATE INDEX idx_knowledge_base_keywords ON knowledge_base USING gin(keywords);
CREATE INDEX idx_outlines_project_id ON outlines(project_id);
CREATE INDEX idx_reference_articles_user_id ON reference_articles(user_id);
CREATE INDEX idx_reference_articles_keywords ON reference_articles USING gin(keywords);
CREATE INDEX idx_materials_user_id ON materials(user_id);
CREATE INDEX idx_materials_keywords ON materials USING gin(keywords);
CREATE INDEX idx_drafts_project_id ON drafts(project_id);
CREATE INDEX idx_reviews_project_id ON reviews(project_id);
CREATE INDEX idx_templates_user_id ON templates(user_id);

CREATE INDEX idx_requirements_project ON requirements(project_id);
CREATE INDEX idx_research_sources_project ON research_sources(project_id);
CREATE INDEX idx_research_sources_relevance ON research_sources(relevance_score DESC);
CREATE INDEX idx_synthesized_insights_project ON synthesized_insights(project_id);
CREATE INDEX idx_synthesized_insights_decision ON synthesized_insights(user_decision);
CREATE INDEX idx_article_structures_project ON article_structures(project_id);
CREATE INDEX idx_review_reports_project ON review_reports(project_id);
CREATE INDEX idx_agent_logs_project ON agent_logs(project_id);
CREATE INDEX idx_agent_logs_agent ON agent_logs(agent_name);
CREATE INDEX idx_agent_logs_created ON agent_logs(created_at DESC);

-- ============================================
-- 触发器
-- ============================================

-- 创建更新时间触发器函数
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 为需要的表添加更新时间触发器
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_briefs_updated_at BEFORE UPDATE ON briefs FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_outlines_updated_at BEFORE UPDATE ON outlines FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_drafts_old_updated_at BEFORE UPDATE ON drafts_old FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_reviews_updated_at BEFORE UPDATE ON reviews FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 创建触发器函数：自动同步用户
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  user_count int;
  extracted_username text;
BEGIN
  SELECT COUNT(*) INTO user_count FROM profiles;
  
  extracted_username := split_part(NEW.email, '@', 1);
  
  INSERT INTO public.profiles (id, username, role)
  VALUES (
    NEW.id,
    extracted_username,
    CASE WHEN user_count = 0 THEN 'admin'::public.user_role ELSE 'user'::public.user_role END
  );
  RETURN NEW;
END;
$$;

-- 创建触发器
DROP TRIGGER IF EXISTS on_auth_user_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_confirmed
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  WHEN (OLD.confirmed_at IS NULL AND NEW.confirmed_at IS NOT NULL)
  EXECUTE FUNCTION handle_new_user();

-- ============================================
-- RLS 策略
-- ============================================

-- 启用 RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE outlines ENABLE ROW LEVEL SECURITY;
ALTER TABLE reference_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE drafts_old ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE synthesized_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_logs ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Projects policies
CREATE POLICY "Users can view their own projects"
  ON projects FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own projects"
  ON projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own projects"
  ON projects FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own projects"
  ON projects FOR DELETE
  USING (auth.uid() = user_id);

-- Briefs policies
CREATE POLICY "Users can view their own briefs"
  ON briefs FOR SELECT
  USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert their own briefs"
  ON briefs FOR INSERT
  WITH CHECK (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

-- Knowledge base policies
CREATE POLICY "Users can view their own knowledge base"
  ON knowledge_base FOR SELECT
  USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert their own knowledge base"
  ON knowledge_base FOR INSERT
  WITH CHECK (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

-- Requirements policies
CREATE POLICY "Users can view their own requirements"
  ON requirements FOR SELECT
  USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert their own requirements"
  ON requirements FOR INSERT
  WITH CHECK (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

-- Research sources policies
CREATE POLICY "Users can view their own research sources"
  ON research_sources FOR SELECT
  USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert their own research sources"
  ON research_sources FOR INSERT
  WITH CHECK (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

-- Synthesized insights policies
CREATE POLICY "Users can view their own insights"
  ON synthesized_insights FOR SELECT
  USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert their own insights"
  ON synthesized_insights FOR INSERT
  WITH CHECK (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

CREATE POLICY "Users can update their own insights"
  ON synthesized_insights FOR UPDATE
  USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

-- Article structures policies
CREATE POLICY "Users can view their own structures"
  ON article_structures FOR SELECT
  USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert their own structures"
  ON article_structures FOR INSERT
  WITH CHECK (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

-- Drafts policies
CREATE POLICY "Users can view their own drafts"
  ON drafts FOR SELECT
  USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert their own drafts"
  ON drafts FOR INSERT
  WITH CHECK (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

-- Review reports policies
CREATE POLICY "Users can view their own reviews"
  ON review_reports FOR SELECT
  USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert their own reviews"
  ON review_reports FOR INSERT
  WITH CHECK (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

-- Agent logs policies
CREATE POLICY "Users can view their own agent logs"
  ON agent_logs FOR SELECT
  USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

CREATE POLICY "Service role can insert agent logs"
  ON agent_logs FOR INSERT
  WITH CHECK (true);

-- ============================================
-- 完成
-- ============================================
-- 迁移完成！
