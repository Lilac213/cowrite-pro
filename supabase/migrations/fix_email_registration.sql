-- ============================================
-- 修复用户注册问题 - 支持真实邮箱验证
-- ============================================

-- 删除旧的触发器
DROP TRIGGER IF EXISTS on_auth_user_confirmed ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 更新 handle_new_user 函数，从 raw_user_meta_data 获取 username
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  user_count int;
  meta_username text;
BEGIN
  SELECT COUNT(*) INTO user_count FROM profiles;
  
  meta_username := NEW.raw_user_meta_data->>'username';
  
  IF meta_username IS NULL THEN
    meta_username := split_part(NEW.email, '@', 1);
  END IF;
  
  INSERT INTO public.profiles (id, username, role)
  VALUES (
    NEW.id,
    meta_username,
    CASE WHEN user_count = 0 THEN 'admin'::public.user_role ELSE 'user'::public.user_role END
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- 创建新的触发器：用户注册时立即创建 profile
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- 为已存在但没有 profile 的用户创建 profile
INSERT INTO public.profiles (id, username, role)
SELECT 
  u.id,
  COALESCE(u.raw_user_meta_data->>'username', split_part(u.email, '@', 1)),
  CASE WHEN (SELECT COUNT(*) FROM profiles) = 0 THEN 'admin'::public.user_role ELSE 'user'::public.user_role END
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
WHERE p.id IS NULL;
