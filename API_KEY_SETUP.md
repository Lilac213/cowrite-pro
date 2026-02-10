# API 密钥配置指南

## 问题描述

当您点击"资料整理"按钮时，看到以下错误：

```
资料整理失败
API 密钥未配置
```

这表示 Research Synthesis Agent 无法调用 LLM API，因为 API 密钥未配置。

## 快速解决（推荐方式）

### 第一步：获取 SiliconFlow API 密钥

1. 访问 **SiliconFlow 官网**：https://cloud.siliconflow.cn
2. 点击右上角"注册/登录"
3. 完成账号注册（支持手机号或邮箱）
4. 登录后进入控制台
5. 在左侧菜单找到"API 密钥"或"API Keys"
6. 点击"创建新密钥"
7. 复制生成的 API Key（格式类似：`sk-xxxxxxxxxxxxxxxxxxxxxx`）

⚠️ **重要**：请妥善保管您的 API Key，不要泄露给他人。

### 第二步：在管理面板配置密钥

1. 以**管理员身份**登录 CoWrite
2. 点击右上角头像，进入"设置"页面
3. 在"系统配置"卡片中，点击"前往管理面板"按钮
4. 在管理面板中，选择"系统配置"标签页
5. 找到"LLM 配置"卡片
6. 在"API 密钥"输入框中粘贴您在第一步复制的 API Key
7. 点击"保存配置"按钮

✅ **完成！** 配置保存后立即生效，无需重启或重新部署。

### 第三步：验证配置

1. 返回 CoWrite 应用
2. 进入"知识研究"阶段
3. 确保已有搜索结果
4. 点击"资料整理"按钮
5. 查看日志，应该显示"启动 Research Synthesis Agent..."并成功完成

## 高级配置（可选）

如果您有 Supabase 项目的管理权限，也可以通过环境变量配置：

### 通过 Supabase Dashboard 配置

1. 打开您的 Supabase 项目 Dashboard
2. 点击左侧菜单的 **Settings**（设置）
3. 选择 **Edge Functions**
4. 找到 **Secrets** 或 **Environment Variables** 部分
5. 点击"Add Secret"或"New Secret"
6. 填写以下信息：
   - **Name**: `QIANWEN_API_KEY`
   - **Value**: [粘贴您的 SiliconFlow API Key]
7. 点击"Save"保存
8. 重新部署 Edge Function（可选，系统会优先使用数据库配置）

### 通过 Supabase CLI 配置

```bash
supabase secrets set QIANWEN_API_KEY=sk-your-api-key-here
supabase functions deploy research-synthesis-agent
```

## 常见问题

### Q1: 我已经配置了 API Key，为什么还是报错？

**A**: 请确保：
1. API Key 格式正确（通常以 `sk-` 开头）
2. 在管理面板中正确保存了配置
3. API Key 在 SiliconFlow 平台上是有效的（未过期、未删除）
4. 刷新页面后重试

### Q2: 我不是管理员，如何配置 API Key？

**A**: API Key 配置需要管理员权限。请联系您的系统管理员进行配置。如果您是项目所有者但不是管理员，可以：
1. 登录 Supabase Dashboard
2. 在数据库中找到 `profiles` 表
3. 将您的用户记录的 `role` 字段改为 `admin`

### Q3: SiliconFlow 是什么？为什么要用它？

**A**: SiliconFlow 是一个 LLM API 服务平台，提供多种开源模型的 API 接口。CoWrite 使用它来调用通义千问（Qwen）模型进行研究综合分析。选择 SiliconFlow 的原因：
- 提供免费额度
- 支持高质量的开源模型
- API 稳定可靠
- 国内访问速度快

### Q4: 使用 SiliconFlow 需要付费吗？

**A**: SiliconFlow 提供免费额度，具体请查看其官网的定价说明。对于个人研究和小规模使用，免费额度通常足够。

### Q5: 可以使用其他 LLM API 吗？

**A**: 目前 CoWrite 的 Research Synthesis Agent 配置为使用 SiliconFlow 的通义千问模型。如果您想使用其他 API（如 OpenAI、Claude 等），需要修改 Edge Function 代码。

### Q6: 如何查看 API 使用情况？

**A**: 登录 SiliconFlow 控制台，在"使用统计"或"Usage"页面可以查看 API 调用次数和消费情况。

### Q7: 配置保存后多久生效？

**A**: 立即生效！系统采用动态配置读取机制，Edge Function 每次调用时都会从数据库读取最新配置，无需重启或重新部署。

### Q8: 如何知道配置是否成功？

**A**: 在管理面板的"LLM 配置"卡片右上角，会显示配置状态：
- ✓ 已配置：表示 API Key 已保存
- 未配置：表示还未配置 API Key

实际是否有效，需要点击"资料整理"按钮测试。

## 技术细节

### 配置读取机制

Edge Function 按以下优先级读取 API 密钥：

1. **数据库配置（优先）**：
   - 表名：`system_config`
   - 配置键：`llm_api_key`
   - 读取时机：每次 Edge Function 调用时
   - 优点：管理员可通过 UI 配置，立即生效

2. **环境变量（备用）**：
   - 变量名：`QIANWEN_API_KEY`
   - 读取时机：数据库配置不存在时
   - 优点：适合高级用户和自动化部署

### 使用的服务和模型

- **API 服务商**: SiliconFlow (https://api.siliconflow.cn)
- **使用模型**: Qwen/Qwen2.5-7B-Instruct
- **API 端点**: https://api.siliconflow.cn/v1/chat/completions
- **认证方式**: Bearer Token

### 相关文件和代码位置

#### Edge Function
- **文件路径**: `/supabase/functions/research-synthesis-agent/index.ts`
- **配置读取**: Line 20-48
- **API 调用**: Line 230-280

#### 管理面板
- **文件路径**: `/src/pages/AdminPage.tsx`
- **LLM 配置 UI**: Line 220-280
- **保存配置逻辑**: Line 97-122

#### 数据库表
- **表名**: `system_config`
- **字段**:
  - `config_key`: 配置键（如 `llm_api_key`）
  - `config_value`: 配置值（API Key）
  - `updated_at`: 更新时间

### 环境变量

Edge Function 使用以下环境变量：

| 变量名 | 说明 | 必需 | 来源 |
|--------|------|------|------|
| `QIANWEN_API_KEY` | SiliconFlow API 密钥 | 可选 | 手动配置 |
| `SUPABASE_URL` | Supabase 项目 URL | ✅ 是 | 自动配置 |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 服务密钥 | ✅ 是 | 自动配置 |

### 配置流程图

```
管理员在 UI 输入 API Key
         ↓
点击"保存配置"按钮
         ↓
调用 updateSystemConfig API
         ↓
写入 system_config 表
         ↓
立即生效（无需重启）
         ↓
下次调用时 Edge Function 读取最新配置
```

## 需要帮助？

如果按照以上步骤操作后仍然遇到问题，请检查：

1. **浏览器控制台**：按 F12 打开开发者工具，查看 Console 标签页的错误信息
2. **Supabase 日志**：在 Supabase Dashboard 的 Logs 页面查看 Edge Function 日志
3. **API 状态**：访问 https://status.siliconflow.cn 查看 SiliconFlow 服务状态

## 安全提示

⚠️ **请注意**：
- 不要在代码中硬编码 API Key
- 不要将 API Key 提交到 Git 仓库
- 不要在公开场合分享您的 API Key
- 定期轮换 API Key 以提高安全性
- 如果 API Key 泄露，立即在 SiliconFlow 控制台删除并重新生成

---

**最后更新**: 2025-02-10
**适用版本**: CoWrite v135+
