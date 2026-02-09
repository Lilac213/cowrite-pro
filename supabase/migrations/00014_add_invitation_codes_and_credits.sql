-- 添加邀请码表
CREATE TABLE IF NOT EXISTS invitation_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(8) UNIQUE NOT NULL,
  ai_reducer_limit INTEGER NOT NULL DEFAULT 0,
  project_limit INTEGER NOT NULL DEFAULT 0,
  used_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 为 profiles 表添加积分和使用限制字段
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS credits INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS ai_reducer_used INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS ai_reducer_limit INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS projects_created INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS project_limit INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS invitation_code VARCHAR(8);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_invitation_codes_code ON invitation_codes(code);
CREATE INDEX IF NOT EXISTS idx_invitation_codes_created_by ON invitation_codes(created_by);
CREATE INDEX IF NOT EXISTS idx_profiles_invitation_code ON profiles(invitation_code);

-- RLS 策略
ALTER TABLE invitation_codes ENABLE ROW LEVEL SECURITY;

-- 管理员可以查看和管理所有邀请码
CREATE POLICY "管理员可以查看所有邀请码" ON invitation_codes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "管理员可以创建邀请码" ON invitation_codes
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "管理员可以更新邀请码" ON invitation_codes
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- 所有用户可以查看自己使用的邀请码
CREATE POLICY "用户可以查看自己的邀请码" ON invitation_codes
  FOR SELECT
  USING (
    code IN (
      SELECT invitation_code FROM profiles
      WHERE profiles.id = auth.uid()
    )
  );

COMMENT ON TABLE invitation_codes IS '邀请码表，用于管理用户注册和权限分配';
COMMENT ON COLUMN invitation_codes.code IS '8位邀请码';
COMMENT ON COLUMN invitation_codes.ai_reducer_limit IS 'AI降重工具使用次数限制';
COMMENT ON COLUMN invitation_codes.project_limit IS '可创建项目数量限制';
COMMENT ON COLUMN invitation_codes.used_count IS '邀请码使用次数';
COMMENT ON COLUMN profiles.credits IS '用户积分余额';
COMMENT ON COLUMN profiles.ai_reducer_used IS 'AI降重工具已使用次数';
COMMENT ON COLUMN profiles.ai_reducer_limit IS 'AI降重工具使用次数限制';
COMMENT ON COLUMN profiles.projects_created IS '已创建项目数量';
COMMENT ON COLUMN profiles.project_limit IS '可创建项目数量限制';
COMMENT ON COLUMN profiles.invitation_code IS '用户使用的邀请码';