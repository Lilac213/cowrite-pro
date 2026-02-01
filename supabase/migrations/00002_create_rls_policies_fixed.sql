-- 启用 RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE outlines ENABLE ROW LEVEL SECURITY;
ALTER TABLE reference_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;

-- 创建辅助函数
CREATE OR REPLACE FUNCTION is_admin(uid uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = uid AND p.role = 'admin'::user_role
  );
$$;

-- Profiles 策略
CREATE POLICY "管理员可以查看所有用户" ON profiles
  FOR SELECT TO authenticated USING (is_admin(auth.uid()));

CREATE POLICY "用户可以查看自己的信息" ON profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);

CREATE POLICY "用户可以更新自己的信息" ON profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id)
  WITH CHECK (role IS NOT DISTINCT FROM (SELECT role FROM profiles WHERE id = auth.uid()));

CREATE POLICY "管理员可以更新所有用户" ON profiles
  FOR UPDATE TO authenticated USING (is_admin(auth.uid()));

-- Projects 策略
CREATE POLICY "用户可以查看自己的项目" ON projects
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "用户可以创建项目" ON projects
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "用户可以更新自己的项目" ON projects
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "用户可以删除自己的项目" ON projects
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Briefs 策略
CREATE POLICY "用户可以查看自己项目的需求" ON briefs
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM projects WHERE projects.id = briefs.project_id AND projects.user_id = auth.uid())
  );

CREATE POLICY "用户可以创建需求" ON briefs
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM projects WHERE projects.id = briefs.project_id AND projects.user_id = auth.uid())
  );

CREATE POLICY "用户可以更新需求" ON briefs
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM projects WHERE projects.id = briefs.project_id AND projects.user_id = auth.uid())
  );

CREATE POLICY "用户可以删除需求" ON briefs
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM projects WHERE projects.id = briefs.project_id AND projects.user_id = auth.uid())
  );

-- Knowledge Base 策略
CREATE POLICY "用户可以查看自己项目的知识库" ON knowledge_base
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM projects WHERE projects.id = knowledge_base.project_id AND projects.user_id = auth.uid())
  );

CREATE POLICY "用户可以创建知识库条目" ON knowledge_base
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM projects WHERE projects.id = knowledge_base.project_id AND projects.user_id = auth.uid())
  );

CREATE POLICY "用户可以更新知识库条目" ON knowledge_base
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM projects WHERE projects.id = knowledge_base.project_id AND projects.user_id = auth.uid())
  );

CREATE POLICY "用户可以删除知识库条目" ON knowledge_base
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM projects WHERE projects.id = knowledge_base.project_id AND projects.user_id = auth.uid())
  );

-- Outlines 策略
CREATE POLICY "用户可以查看自己项目的大纲" ON outlines
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM projects WHERE projects.id = outlines.project_id AND projects.user_id = auth.uid())
  );

CREATE POLICY "用户可以创建大纲" ON outlines
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM projects WHERE projects.id = outlines.project_id AND projects.user_id = auth.uid())
  );

CREATE POLICY "用户可以更新大纲" ON outlines
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM projects WHERE projects.id = outlines.project_id AND projects.user_id = auth.uid())
  );

CREATE POLICY "用户可以删除大纲" ON outlines
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM projects WHERE projects.id = outlines.project_id AND projects.user_id = auth.uid())
  );

-- Reference Articles 策略
CREATE POLICY "用户可以查看自己的参考文章" ON reference_articles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "用户可以创建参考文章" ON reference_articles
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "用户可以更新参考文章" ON reference_articles
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "用户可以删除参考文章" ON reference_articles
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Materials 策略
CREATE POLICY "用户可以查看自己的素材" ON materials
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "用户可以创建素材" ON materials
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "用户可以更新素材" ON materials
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "用户可以删除素材" ON materials
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Drafts 策略
CREATE POLICY "用户可以查看自己项目的草稿" ON drafts
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM projects WHERE projects.id = drafts.project_id AND projects.user_id = auth.uid())
  );

CREATE POLICY "用户可以创建草稿" ON drafts
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM projects WHERE projects.id = drafts.project_id AND projects.user_id = auth.uid())
  );

CREATE POLICY "用户可以更新草稿" ON drafts
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM projects WHERE projects.id = drafts.project_id AND projects.user_id = auth.uid())
  );

CREATE POLICY "用户可以删除草稿" ON drafts
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM projects WHERE projects.id = drafts.project_id AND projects.user_id = auth.uid())
  );

-- Reviews 策略
CREATE POLICY "用户可以查看自己项目的审校" ON reviews
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM projects WHERE projects.id = reviews.project_id AND projects.user_id = auth.uid())
  );

CREATE POLICY "用户可以创建审校" ON reviews
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM projects WHERE projects.id = reviews.project_id AND projects.user_id = auth.uid())
  );

CREATE POLICY "用户可以更新审校" ON reviews
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM projects WHERE projects.id = reviews.project_id AND projects.user_id = auth.uid())
  );

CREATE POLICY "用户可以删除审校" ON reviews
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM projects WHERE projects.id = reviews.project_id AND projects.user_id = auth.uid())
  );

-- Templates 策略
CREATE POLICY "用户可以查看自己的模板" ON templates
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "用户可以创建模板" ON templates
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "用户可以更新模板" ON templates
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "用户可以删除模板" ON templates
  FOR DELETE TO authenticated USING (user_id = auth.uid());