-- 修改积分系统：移除限制字段，只保留使用次数和可用点数
ALTER TABLE profiles DROP COLUMN IF EXISTS ai_reducer_limit;
ALTER TABLE profiles DROP COLUMN IF EXISTS project_limit;
ALTER TABLE profiles RENAME COLUMN credits TO available_credits;

-- 添加管理员无限点数标识
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS unlimited_credits BOOLEAN NOT NULL DEFAULT false;

-- 更新管理员账户为无限点数
UPDATE profiles SET unlimited_credits = true WHERE role = 'admin';

-- 创建订单状态枚举
DO $$ BEGIN
  CREATE TYPE order_status AS ENUM ('pending', 'completed', 'cancelled', 'refunded');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 创建订单表用于Stripe支付
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  items JSONB NOT NULL,
  total_amount NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'cny',
  status order_status NOT NULL DEFAULT 'pending',
  stripe_session_id TEXT UNIQUE,
  stripe_payment_intent_id TEXT,
  customer_email TEXT,
  customer_name TEXT,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_stripe_session_id ON orders(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

-- RLS 策略
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- 用户可以查看自己的订单
CREATE POLICY "用户可以查看自己的订单" ON orders
  FOR SELECT
  USING (user_id = auth.uid());

-- 只有 service role 可以插入和更新订单
CREATE POLICY "Service role 可以管理订单" ON orders
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- 更新邀请码表，移除限制字段
ALTER TABLE invitation_codes DROP COLUMN IF EXISTS ai_reducer_limit;
ALTER TABLE invitation_codes DROP COLUMN IF EXISTS project_limit;
ALTER TABLE invitation_codes ADD COLUMN IF NOT EXISTS credits INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN profiles.available_credits IS '用户可用点数';
COMMENT ON COLUMN profiles.unlimited_credits IS '是否拥有无限点数（管理员）';
COMMENT ON COLUMN profiles.ai_reducer_used IS 'AI降重工具已使用次数';
COMMENT ON COLUMN profiles.projects_created IS '已创建项目数量';
COMMENT ON COLUMN invitation_codes.credits IS '邀请码赠送的点数';
COMMENT ON TABLE orders IS 'Stripe支付订单表';