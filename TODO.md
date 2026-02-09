# 任务：邀请码和积分系统升级（第二轮）

## 完成情况

### ✅ 已完成

#### 1. 购买点数页面优化
- [x] 增大对话框尺寸（max-w-5xl）
- [x] 增加标题字号（text-2xl）
- [x] 增加描述字号（text-base）
- [x] 增加套餐名称字号（text-xl）
- [x] 增加价格字号（text-4xl）
- [x] 增加点数字号（text-base）
- [x] 增加按钮字号和高度（text-base py-6）
- [x] 增加卡片间距（gap-6）
- [x] 增加内容间距（space-y-6, pb-8, pt-8）

#### 2. 注册时邀请码功能
- [x] 注册表单添加邀请码输入框（可选）
- [x] 邀请码自动转大写
- [x] 注册成功后自动应用邀请码
- [x] 邀请码失败不影响注册
- [x] 显示邀请码应用结果

#### 3. 用户信息邀请码功能
- [x] 未绑定邀请码时显示输入框
- [x] 已绑定邀请码时显示邀请码信息
- [x] 邀请码验证和应用功能
- [x] 应用成功后自动刷新用户信息

#### 4. 邀请码绑定机制
- [x] 数据库添加唯一约束（一个邀请码只能绑定一个用户）
- [x] 管理员用户列表显示邀请码列
- [x] 显示用户绑定的邀请码
- [x] 未绑定显示"-"

#### 5. 用户名唯一性检查
- [x] 数据库添加用户名唯一约束
- [x] 注册前检查用户名是否已存在
- [x] 显示友好的错误提示
- [x] 用户名格式验证（字母、数字、下划线）

#### 6. 新用户默认点数
- [x] 修改数据库默认值为2点
- [x] 更新触发器函数
- [x] 管理员默认0点（无限点数）
- [x] 普通用户默认2点（1次AI降重 + 1次项目创建）

#### 7. AuthContext 更新
- [x] signUpWithUsername 返回 userId
- [x] 注册时传递 username 到 user_metadata
- [x] refreshProfile 函数供外部调用

## 功能说明

### 购买点数页面改进
- **更大的对话框**：从 max-w-4xl 增加到 max-w-5xl
- **更大的字号**：
  - 标题：text-2xl
  - 价格：text-4xl
  - 点数：text-base
  - 按钮：text-base py-6
- **更大的间距**：
  - 卡片间距：gap-6
  - 内容间距：space-y-6
  - 内边距：pb-8, pt-8

### 邀请码系统
1. **注册时使用**：
   - 可选填写邀请码
   - 自动转大写
   - 注册成功后自动应用
   - 失败不影响注册

2. **用户信息使用**：
   - 未绑定时显示输入框
   - 已绑定时显示邀请码
   - 一次性绑定，不可更改

3. **管理员查看**：
   - 用户列表显示邀请码列
   - 查看用户使用的邀请码
   - 未使用显示"-"

### 用户名唯一性
- 数据库级别唯一约束
- 注册前检查是否重复
- 友好的错误提示
- 格式验证

### 新用户权益
- 默认2点（可用于1次AI降重 + 1次项目创建）
- 管理员无限点数
- 可通过邀请码获得更多点数
- 可购买点数

## 已知问题和说明

### 1. 支付功能
- **状态**：已集成 Stripe 支付
- **问题**：需要配置 STRIPE_SECRET_KEY 环境变量
- **解决**：在 Supabase 项目设置中添加 STRIPE_SECRET_KEY

### 2. 文章结构生成
- **状态**：Edge Function 已部署
- **问题**：需要配置 INTEGRATIONS_API_KEY 环境变量
- **解决**：在 Supabase 项目设置中添加 INTEGRATIONS_API_KEY

### 3. 环境变量配置
需要在 Supabase 项目中配置以下环境变量：
- `STRIPE_SECRET_KEY`：Stripe 支付密钥
- `INTEGRATIONS_API_KEY`：AI 服务密钥

## 技术细节

### 数据库约束
```sql
-- 邀请码唯一约束
ALTER TABLE profiles ADD CONSTRAINT profiles_invitation_code_unique UNIQUE (invitation_code);

-- 用户名唯一约束
ALTER TABLE profiles ADD CONSTRAINT profiles_username_unique UNIQUE (username);

-- 默认点数
ALTER TABLE profiles ALTER COLUMN available_credits SET DEFAULT 2;
```

### 触发器更新
```sql
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
    CASE WHEN user_count = 0 THEN 0 ELSE 2 END
  );
  RETURN NEW;
END;
$$;
```

## 测试建议

1. **注册流程**：
   - 测试不带邀请码注册
   - 测试带邀请码注册
   - 测试用户名重复
   - 测试用户名格式

2. **邀请码功能**：
   - 测试在用户信息页面使用邀请码
   - 测试邀请码重复绑定
   - 测试无效邀请码

3. **购买点数**：
   - 配置 STRIPE_SECRET_KEY 后测试支付流程
   - 测试支付成功后点数充值

4. **默认点数**：
   - 注册新用户检查默认2点
   - 测试创建1个项目
   - 测试使用1次AI降重

