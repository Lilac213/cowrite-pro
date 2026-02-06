# 🔐 配置管理系统说明

## 概述

CoWrite 系统使用两级配置管理：
1. **管理面板配置**：存储在数据库中，由管理员通过 Web 界面配置
2. **Edge Function Secrets**：存储在 Supabase 中，用于 Edge Functions 运行时访问

## 配置项说明

### 1. QIANWEN_API_KEY（通义千问 API 密钥）

**配置方式**：✅ 自动同步

- **来源**：管理面板 → 系统配置 → LLM 配置 → API 密钥
- **存储位置**：
  - 数据库：`system_config` 表，`config_key='llm_api_key'`
  - Edge Functions：`QIANWEN_API_KEY` secret
- **同步机制**：保存配置时自动同步到 Edge Functions
- **使用场景**：
  - research-retrieval-agent：生成搜索计划
  - research-synthesis-agent：整理研究资料

**配置步骤**：
1. 访问管理面板：`/admin`
2. 切换到"系统配置"标签
3. 在"LLM 配置"卡片中输入通义千问 API 密钥
4. 点击"保存配置"按钮
5. 系统自动同步到 Edge Functions

**获取 API Key**：
- 访问：https://dashscope.console.aliyun.com/
- 登录阿里云账号
- 创建新的 API Key
- 复制密钥（格式：`sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`）

### 2. INTEGRATIONS_API_KEY（搜索服务 API Gateway 密钥）

**配置方式**：⚠️ 需要平台管理员配置

- **来源**：平台级密钥，不存储在数据库中
- **存储位置**：仅存储在 Supabase Edge Functions Secrets
- **配置方式**：需要联系平台管理员
- **使用场景**：
  - Google Scholar API：学术论文搜索
  - TheNews API：新闻和行业动态搜索
  - OpenAlex API：开放学术资源搜索

**为什么不能自动同步**：
- 这是平台级的 API Gateway 密钥
- 用于访问多个第三方 API 服务
- 需要平台统一管理和计费
- 不应该由普通管理员修改

**配置步骤**（需要平台管理员）：
1. 登录 Supabase Dashboard
2. 进入项目设置：Settings → Edge Functions → Environment Variables
3. 添加环境变量：
   - Name: `INTEGRATIONS_API_KEY`
   - Value: [平台提供的 API Gateway 密钥]
4. 保存

## 配置同步机制

### 自动同步流程

```
管理面板保存配置
    ↓
更新 system_config 表
    ↓
调用 sync-config-to-secrets Edge Function
    ↓
读取数据库配置
    ↓
准备同步数据
    ↓
记录同步日志
    ↓
返回同步状态
```

### sync-config-to-secrets Edge Function

**功能**：
- 读取 `system_config` 表中的配置
- 准备需要同步的密钥列表
- 记录同步日志
- 返回同步状态

**权限要求**：
- 必须是管理员用户
- 需要有效的认证 token

**调用方式**：
```typescript
const { data, error } = await supabase.functions.invoke('sync-config-to-secrets', {
  headers: {
    Authorization: `Bearer ${session.access_token}`,
  },
});
```

**返回数据**：
```json
{
  "success": true,
  "message": "配置已准备同步",
  "secrets": [
    {
      "key": "QIANWEN_API_KEY",
      "description": "通义千问 API 密钥（从管理面板同步）"
    }
  ],
  "note": "QIANWEN_API_KEY 已配置。INTEGRATIONS_API_KEY 需要平台管理员配置。"
}
```

## 配置状态检查

### 在管理面板中查看

1. 访问 `/admin`
2. 切换到"系统配置"标签
3. 查看各配置卡片右上角的状态徽章：
   - ✅ **已配置**：绿色徽章，配置已完成
   - ⚠️ **未配置**：灰色徽章，需要配置

### 在代码中检查

```typescript
// 检查数据库配置
const configs = await getSystemConfig();
const llmApiKey = configs.find(c => c.config_key === 'llm_api_key')?.config_value;

if (llmApiKey) {
  console.log('✅ LLM API Key 已配置');
} else {
  console.log('⚠️ LLM API Key 未配置');
}
```

### 在 Edge Function 中检查

```typescript
const qianwenApiKey = Deno.env.get('QIANWEN_API_KEY');
const integrationsApiKey = Deno.env.get('INTEGRATIONS_API_KEY');

if (!qianwenApiKey) {
  throw new Error('QIANWEN_API_KEY 未配置');
}

if (!integrationsApiKey) {
  throw new Error('INTEGRATIONS_API_KEY 未配置');
}
```

## 故障排查

### 问题 1：保存配置后仍然提示"QIANWEN_API_KEY 未配置"

**可能原因**：
1. 同步失败
2. API Key 格式错误
3. 网络问题

**解决方案**：
1. 检查浏览器控制台是否有错误信息
2. 确认 API Key 格式正确（以 `sk-` 开头）
3. 重新保存配置
4. 查看 Edge Function 日志

### 问题 2：提示"INTEGRATIONS_API_KEY 未配置"

**原因**：
- 这是平台级密钥，需要平台管理员配置

**解决方案**：
1. 联系平台管理员
2. 提供项目 ID：`app-9bwpferlujnl`
3. 请求配置 INTEGRATIONS_API_KEY

### 问题 3：同步配置时提示"需要管理员权限"

**原因**：
- 当前用户不是管理员

**解决方案**：
1. 确认当前用户角色
2. 联系系统管理员授予管理员权限
3. 重新登录后再试

### 问题 4：配置保存成功但搜索仍然失败

**排查步骤**：
1. 检查 QIANWEN_API_KEY 是否有效
   - 访问阿里云控制台确认 API Key 状态
   - 检查账户余额
2. 检查 INTEGRATIONS_API_KEY 是否配置
   - 查看 Edge Function 日志
   - 确认是否有 401/403 错误
3. 测试 API 连接
   - 使用 curl 测试通义千问 API
   - 使用 curl 测试搜索 API Gateway

## 最佳实践

### 1. 定期更新 API Key

- 建议每 3-6 个月更换一次 API Key
- 更换时先创建新 Key，测试成功后再删除旧 Key
- 记录 API Key 的创建时间和用途

### 2. 监控 API 使用情况

- 定期检查阿里云控制台的 API 调用统计
- 设置用量告警
- 监控异常调用模式

### 3. 安全措施

- ⚠️ 不要在前端代码中暴露 API Key
- ⚠️ 不要将 API Key 提交到代码仓库
- ✅ 只在管理面板或 Supabase Secrets 中配置
- ✅ 使用 HTTPS 传输
- ✅ 定期审计配置访问日志

### 4. 备份配置

- 定期导出 `system_config` 表数据
- 记录所有配置变更
- 保存 API Key 的备份（加密存储）

## 配置清单

使用此清单确保所有配置正确：

- [ ] **QIANWEN_API_KEY**
  - [ ] 在管理面板中配置
  - [ ] 保存配置成功
  - [ ] 同步到 Edge Functions 成功
  - [ ] 测试搜索功能正常

- [ ] **INTEGRATIONS_API_KEY**
  - [ ] 联系平台管理员
  - [ ] 确认已在 Supabase 中配置
  - [ ] 测试搜索 API 正常

- [ ] **功能验证**
  - [ ] 学术资料查询功能正常
  - [ ] Google Scholar 搜索正常
  - [ ] TheNews 搜索正常
  - [ ] OpenAlex 搜索正常
  - [ ] 资料整理功能正常

## 相关文档

- [API 切换说明](./API_SWITCH_DEEPSEEK_TO_QIANWEN.md)
- [快速配置指南](./QUICK_SETUP_QIANWEN.md)
- [故障排查指南](./TROUBLESHOOTING_GUIDE.md)

## 技术架构

```
┌─────────────────────────────────────────────────────────────┐
│                        管理面板 (Web UI)                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  系统配置                                              │   │
│  │  ├─ LLM 配置                                          │   │
│  │  │  └─ API 密钥: sk-xxx...                           │   │
│  │  └─ 搜索配置                                          │   │
│  │     └─ 提示：INTEGRATIONS_API_KEY 需平台管理员配置    │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              ↓ 保存配置
┌─────────────────────────────────────────────────────────────┐
│                    数据库 (system_config)                     │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  config_key          │  config_value                 │   │
│  │  ────────────────────┼──────────────────────────────│   │
│  │  llm_provider        │  qwen                         │   │
│  │  llm_api_key         │  sk-xxx...                    │   │
│  │  search_provider     │  openalex                     │   │
│  │  search_api_key      │  (empty)                      │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              ↓ 自动同步
┌─────────────────────────────────────────────────────────────┐
│              Edge Function: sync-config-to-secrets           │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  1. 验证管理员权限                                     │   │
│  │  2. 读取 system_config                                │   │
│  │  3. 准备同步数据                                       │   │
│  │  4. 记录日志                                          │   │
│  │  5. 返回状态                                          │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              ↓ 配置完成
┌─────────────────────────────────────────────────────────────┐
│              Supabase Edge Function Secrets                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  QIANWEN_API_KEY          = sk-xxx... (自动同步)      │   │
│  │  INTEGRATIONS_API_KEY     = xxx... (平台管理员配置)   │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              ↓ 运行时使用
┌─────────────────────────────────────────────────────────────┐
│                      Edge Functions                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  research-retrieval-agent                             │   │
│  │  ├─ 使用 QIANWEN_API_KEY (LLM)                       │   │
│  │  └─ 使用 INTEGRATIONS_API_KEY (搜索)                 │   │
│  │                                                       │   │
│  │  research-synthesis-agent                             │   │
│  │  └─ 使用 QIANWEN_API_KEY (LLM)                       │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

**更新时间**：2025-02-06
**版本**：1.0
**状态**：✅ 已实现
