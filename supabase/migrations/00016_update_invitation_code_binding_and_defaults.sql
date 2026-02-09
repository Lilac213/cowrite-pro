-- 修改邀请码字段为唯一约束（一个邀请码只能绑定一个用户）
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_invitation_code_key;
ALTER TABLE profiles ADD CONSTRAINT profiles_invitation_code_unique UNIQUE (invitation_code);

-- 添加用户名唯一约束
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_username_key;
ALTER TABLE profiles ADD CONSTRAINT profiles_username_unique UNIQUE (username);

-- 修改默认值：新用户默认2点（1次AI降重 + 1次项目创建）
ALTER TABLE profiles ALTER COLUMN available_credits SET DEFAULT 2;

-- 更新触发器函数，设置新用户默认2点
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  user_count int;
BEGIN
  SELECT COUNT(*) INTO user_count FROM profiles;
  
  INSERT INTO public.profiles (id, username, role, available_credits)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    CASE WHEN user_count = 0 THEN 'admin'::public.user_role ELSE 'user'::public.user_role END,
    CASE WHEN user_count = 0 THEN 0 ELSE 2 END  -- 管理员0点（无限），普通用户2点
  );
  RETURN NEW;
END;
$$;

COMMENT ON COLUMN profiles.invitation_code IS '邀请码（一个邀请码只能绑定一个用户）';
COMMENT ON COLUMN profiles.username IS '用户名（唯一）';
COMMENT ON COLUMN profiles.available_credits IS '可用点数（新用户默认2点）';