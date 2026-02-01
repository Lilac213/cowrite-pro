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
  updated_at timestamptz NOT NULL DEFAULT now()
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

-- 创建草稿表
CREATE TABLE public.drafts (
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

-- 创建索引
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
  
  -- 从邮箱中提取用户名
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
CREATE TRIGGER update_drafts_updated_at BEFORE UPDATE ON drafts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_reviews_updated_at BEFORE UPDATE ON reviews FOR EACH ROW EXECUTE FUNCTION update_updated_at();