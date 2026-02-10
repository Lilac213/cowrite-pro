# API 密钥配置指南

## 问题描述

当您点击"资料整理"按钮时，看到以下错误：

```
资料整理失败
Edge Function returned a non-2xx status code
LLM API 调用失败 (401): Api key is invalid
```

这表示 Research Synthesis Agent 无法调用 LLM API，因为 API 密钥未配置或无效。

## 解决步骤

### 第一步：获取 SiliconFlow API 密钥

1. 访问 **SiliconFlow 官网**：https://cloud.siliconflow.cn
2. 点击右上角"注册/登录"
3. 完成账号注册（支持手机号或邮箱）
4. 登录后进入控制台
5. 在左侧菜单找到"API 密钥"或"API Keys"
6. 点击"创建新密钥"
7. 复制生成的 API Key（格式类似：`sk-xxxxxxxxxxxxxxxxxxxxxx`）

⚠️ **重要**：请妥善保管您的 API Key，不要泄露给他人。

### 第二步：在 Supabase 中配置密钥

#### 方法 1：通过 Supabase Dashboard（推荐）

1. 打开您的 Supabase 项目 Dashboard
2. 点击左侧菜单的 **Settings**（设置）
3. 选择 **Edge Functions**
4. 找到 **Secrets** 或 **Environment Variables** 部分
5. 点击"Add Secret"或"New Secret"
6. 填写以下信息：
   - **Name**: `QIANWEN_API_KEY`
   - **Value**: [粘贴您在第一步复制的 API Key]
7. 点击"Save"保存

#### 方法 2：通过 Supabase CLI

如果您使用命令行工具，可以运行：

```bash
supabase secrets set QIANWEN_API_KEY=sk-your-api-key-here
```

### 第三步：重新部署 Edge Function

配置密钥后，需要重新部署 Edge Function 才能生效。

#### 方法 1：通过 Miaoda 平台

1. 在 Miaoda 项目页面
2. 找到"同步配置"或"重新部署"按钮
3. 点击并等待部署完成

#### 方法 2：通过 Supabase CLI

```bash
supabase functions deploy research-synthesis-agent
```

### 第四步：验证配置

1. 返回 CoWrite 应用
2. 进入"知识研究"阶段
3. 确保已有搜索结果
4. 点击"资料整理"按钮
5. 查看日志，应该显示"启动 Research Synthesis Agent..."并成功完成

## 常见问题

### Q1: 我已经配置了 API Key，为什么还是报错？

**A**: 请确保：
1. API Key 格式正确（通常以 `sk-` 开头）
2. 密钥名称完全匹配：`QIANWEN_API_KEY`（区分大小写）
3. 配置后已重新部署 Edge Function
4. API Key 在 SiliconFlow 平台上是有效的（未过期、未删除）

### Q2: SiliconFlow 是什么？为什么要用它？

**A**: SiliconFlow 是一个 LLM API 服务平台，提供多种开源模型的 API 接口。CoWrite 使用它来调用通义千问（Qwen）模型进行研究综合分析。

### Q3: 使用 SiliconFlow 需要付费吗？

**A**: SiliconFlow 提供免费额度，具体请查看其官网的定价说明。对于个人研究和小规模使用，免费额度通常足够。

### Q4: 可以使用其他 LLM API 吗？

**A**: 目前 CoWrite 的 Research Synthesis Agent 配置为使用 SiliconFlow 的通义千问模型。如果您想使用其他 API（如 OpenAI、Claude 等），需要修改 Edge Function 代码。

### Q5: 如何查看 API 使用情况？

**A**: 登录 SiliconFlow 控制台，在"使用统计"或"Usage"页面可以查看 API 调用次数和消费情况。

## 技术细节

### 使用的服务和模型

- **API 服务商**: SiliconFlow (https://api.siliconflow.cn)
- **使用模型**: Qwen/Qwen2.5-7B-Instruct
- **API 端点**: https://api.siliconflow.cn/v1/chat/completions
- **认证方式**: Bearer Token

### Edge Function 位置

- 文件路径: `/supabase/functions/research-synthesis-agent/index.ts`
- 密钥获取: Line 28
- API 调用: Line 230-245

### 环境变量

Edge Function 需要以下环境变量：

| 变量名 | 说明 | 必需 |
|--------|------|------|
| `QIANWEN_API_KEY` | SiliconFlow API 密钥 | ✅ 是 |
| `SUPABASE_URL` | Supabase 项目 URL | ✅ 是（自动配置） |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 服务密钥 | ✅ 是（自动配置） |

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
