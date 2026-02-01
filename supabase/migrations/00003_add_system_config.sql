
-- 创建系统配置表
CREATE TABLE IF NOT EXISTS system_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key TEXT UNIQUE NOT NULL,
  config_value TEXT NOT NULL,
  updated_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 插入默认配置
INSERT INTO system_config (config_key, config_value) 
VALUES 
  ('llm_provider', 'qwen'),
  ('llm_api_key', ''),
  ('search_provider', 'openalex'),
  ('search_api_key', '')
ON CONFLICT (config_key) DO NOTHING;

-- 创建 RLS 策略
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

-- 管理员可以查看和修改
CREATE POLICY "管理员可以查看系统配置" ON system_config
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "管理员可以修改系统配置" ON system_config
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- 创建更新时间触发器
CREATE OR REPLACE FUNCTION update_system_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER system_config_updated_at
  BEFORE UPDATE ON system_config
  FOR EACH ROW
  EXECUTE FUNCTION update_system_config_updated_at();

COMMENT ON TABLE system_config IS '系统全局配置，仅管理员可修改';
COMMENT ON COLUMN system_config.config_key IS '配置键：llm_provider, llm_api_key, search_provider, search_api_key';
COMMENT ON COLUMN system_config.config_value IS '配置值';
