# API 密钥配置指南

## LLM 服务架构

CoWrite 使用**双层 LLM 架构**，确保服务的稳定性和可用性：

### 第一层：内置 Gemini 模型（优先）
- **模型**: Google Gemini 2.5 Flash
- **特点**: 系统内置，无需配置，免费使用
- **优势**: 响应快速，稳定可靠

### 第二层：用户配置的 Qwen 模型（回退）
- **模型**: Qwen Plus (通过阿里云 DashScope)
- **特点**: 需要管理员配置 API 密钥
- **用途**: 当 Gemini 不可用时自动切换

## 工作原理

```
用户请求 → 尝试调用 Gemini
              ↓
         Gemini 成功？
         ↙        ↘
       是          否
       ↓           ↓
    返回结果    尝试调用 Qwen
                   ↓
              Qwen 成功？
              ↙        ↘
            是          否
            ↓           ↓
         返回结果    返回错误
```

## 何时需要配置 API 密钥？

**大多数情况下不需要配置**。系统会优先使用内置的 Gemini 模型。

**仅在以下情况需要配置**：
1. Gemini 服务暂时不可用
2. 需要使用特定的 Qwen 模型特性
3. 系统提示"Gemini 和 Qwen 均不可用"

## 配置步骤（可选）

**注意**：大多数情况下不需要配置。仅在 Gemini 不可用时需要配置 Qwen 作为备用。

### 第一步：获取阿里云 DashScope API 密钥

1. 访问 **阿里云 DashScope 控制台**：https://dashscope.console.aliyun.com/
2. 注册/登录阿里云账号
3. 开通 DashScope 服务（可能需要实名认证）
4. 在"API-KEY 管理"页面创建新的 API Key
5. 复制生成的 API Key（格式类似：`sk-xxxxxxxxxxxxxxxxxxxxxx`）

⚠️ **重要**：请妥善保管您的 API Key，不要泄露给他人。

### 第二步：联系技术支持配置

由于系统架构调整，API Key 配置需要通过技术支持完成：

1. 准备好您的 DashScope API Key
2. 联系技术支持人员
3. 提供 API Key 给技术支持
4. 技术人员将为您配置到系统环境变量中

### 第三步：验证配置

1. 配置完成后，系统会在 Gemini 不可用时自动使用 Qwen
2. 您可以在 Edge Function 日志中查看模型切换情况
3. 日志会显示"✓ Qwen 调用成功（回退）"

## 高级配置（可选）

如果您有 Supabase 项目的管理权限，也可以通过环境变量配置：

### 通过 Supabase Dashboard 配置

1. 打开您的 Supabase 项目 Dashboard
2. 点击左侧菜单的 **Settings**（设置）
3. 选择 **Edge Functions**
4. 找到 **Secrets** 或 **Environment Variables** 部分
5. 点击"Add Secret"或"New Secret"
6. 填写以下信息：
   - **Name**: `DASHSCOPE_API_KEY`
   - **Value**: [粘贴您的阿里云 DashScope API Key]
7. 点击"Save"保存
8. 重新部署 Edge Function

### 通过 Supabase CLI 配置

```bash
supabase secrets set DASHSCOPE_API_KEY=sk-your-api-key-here
supabase functions deploy research-synthesis-agent
supabase functions deploy llm-generate
supabase functions deploy summarize-content
```

## 常见问题

### Q1: 我需要配置 API Key 吗？

**A**: 大多数情况下**不需要**。系统默认使用内置的 Gemini 模型，无需任何配置即可使用。只有当 Gemini 不可用时，才需要配置 Qwen API Key 作为备用。

### Q2: 如何知道系统正在使用哪个模型？

**A**: 查看 Edge Function 日志（Supabase Dashboard → Edge Functions → Logs），会显示：
- `✓ Gemini 调用成功` - 使用 Gemini
- `✓ Qwen 调用成功（回退）` - 使用 Qwen

### Q3: Gemini 是免费的吗？

**A**: 是的，内置的 Gemini 模型由系统提供，用户无需支付任何费用。

### Q4: 我已经配置了 API Key，为什么还是报错？

**A**: 请确保：
1. API Key 格式正确（通常以 `sk-` 开头）
2. 在管理面板中正确保存了配置
3. API Key 在 SiliconFlow 平台上是有效的（未过期、未删除）
4. 刷新页面后重试

### Q5: 我不是管理员，如何配置 API Key？

**A**: API Key 配置需要管理员权限。请联系您的系统管理员进行配置。如果您是项目所有者但不是管理员，可以：
1. 登录 Supabase Dashboard
2. 在数据库中找到 `profiles` 表
3. 将您的用户记录的 `role` 字段改为 `admin`

### Q6: 阿里云 DashScope 是什么？为什么要用它？

**A**: 阿里云 DashScope 是阿里云提供的大模型服务平台，提供通义千问等模型的 API 接口。CoWrite 使用它作为 Gemini 的备用方案。选择 DashScope 的原因：
- 阿里云官方服务，稳定可靠
- 支持高质量的通义千问模型
- 国内访问速度快
- 提供免费额度

### Q7: 使用阿里云 DashScope 需要付费吗？

**A**: DashScope 提供免费额度，具体请查看阿里云官网的定价说明。对于个人研究和小规模使用，免费额度通常足够。

### Q8: 可以使用其他 LLM API 吗？

**A**: 目前 CoWrite 支持 Gemini 和 Qwen 两种模型。如果您想使用其他 API（如 OpenAI、Claude 等），需要修改 Edge Function 代码。

### Q9: 如何查看 API 使用情况？

**A**: 
- **Gemini**: 系统内置，无需查看使用情况
- **Qwen**: 登录阿里云 DashScope 控制台，在"用量中心"或"Usage"页面可以查看 API 调用次数和消费情况

### Q10: 配置保存后多久生效？

**A**: 配置通过环境变量设置后，需要重新部署 Edge Function 才能生效。部署完成后立即可用。

### Q11: 如何知道配置是否成功？

**A**: 在管理面板的"LLM 服务状态"卡片中，会显示"✓ 服务正常"。实际是否有效，需要点击"资料整理"按钮测试，并查看 Edge Function 日志中的模型使用情况。

## 技术细节

### LLM 调用架构

CoWrite 实现了**智能回退机制**，确保服务的高可用性：

```typescript
async function callLLM(options) {
  try {
    // 第一次尝试：调用内置 Gemini
    return await callGemini(options);
  } catch (geminiError) {
    // 第二次尝试：调用用户配置的 Qwen
    const apiKey = await getQwenApiKey();
    if (!apiKey) {
      throw new Error("两个模型均不可用");
    }
    return await callQwen(options, apiKey);
  }
}
```

### 使用的服务和模型

#### 主要模型：Gemini 2.5 Flash
- **API 端点**: `https://app-9bwpferlujnl-api-VaOwP8E7dJqa.gateway.appmedo.com/v1beta/models/gemini-2.5-flash:generateContent`
- **提供商**: Google (系统内置)
- **认证方式**: 无需认证（系统级）
- **特点**: 快速、稳定、免费

#### 备用模型：Qwen Plus
- **API 端点**: `https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation`
- **提供商**: 阿里云 DashScope
- **认证方式**: Bearer Token
- **特点**: 高质量中文支持

### 配置读取机制

Edge Function 按以下优先级读取 Qwen API 密钥：

1. **数据库配置（优先）**：
   - 表名：`system_config`
   - 配置键：`llm_api_key`
   - 读取时机：每次 Edge Function 调用时
   - 优点：管理员可通过 UI 配置，立即生效

2. **环境变量（备用）**：
   - 变量名：`DASHSCOPE_API_KEY`
   - 读取时机：数据库配置不存在时
   - 优点：适合高级用户和自动化部署

### 相关文件和代码位置

#### Edge Functions
所有 Edge Function 都内置了统一的 LLM 调用逻辑：

1. **research-synthesis-agent**
   - 文件路径: `/supabase/functions/research-synthesis-agent/index.ts`
   - LLM 客户端: Line 12-155
   - 调用位置: Line 246-253

2. **llm-generate**
   - 文件路径: `/supabase/functions/llm-generate/index.ts`
   - LLM 客户端: Line 8-135
   - 调用位置: Line 171-177

3. **summarize-content**
   - 文件路径: `/supabase/functions/summarize-content/index.ts`
   - LLM 客户端: Line 8-130
   - 调用位置: Line 145-151

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
| `DASHSCOPE_API_KEY` | 阿里云 DashScope API 密钥 | 可选 | 手动配置 |
| `SUPABASE_URL` | Supabase 项目 URL | ✅ 是 | 自动配置 |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 服务密钥 | ✅ 是 | 自动配置 |

### 调用流程图

```
用户请求（如：资料整理）
         ↓
Edge Function 接收请求
         ↓
调用 callLLM()
         ↓
尝试 Gemini API
         ↓
    成功？
    ↙  ↘
  是    否
  ↓     ↓
返回  从数据库读取 Qwen API Key
结果    ↓
     存在？
     ↙  ↘
   是    否
   ↓     ↓
调用   返回
Qwen  错误
API
   ↓
 成功？
 ↙  ↘
是    否
↓     ↓
返回  返回
结果  错误
```

### 已移除的功能

为了简化架构和提高维护性，以下功能已被移除：

1. **OpenAI 集成**: 移除了 OpenAI API 调用代码
2. **Anthropic 集成**: 移除了 Claude API 调用代码
3. **Tavily Search**: 删除了 tavily-search Edge Function
4. **Smart Search**: 删除了 smart-search Edge Function

所有 LLM 调用现在统一使用 Gemini + Qwen 双层架构。

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
