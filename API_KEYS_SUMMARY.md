# 项目第三方API密钥总结

## 🔑 需要配置的API密钥

### 1. **SERPAPI_API_KEY** (必需 - 核心功能)
- **用途**:
  - Google Scholar 学术搜索
  - Google News 新闻搜索
  - Google Search 网页搜索
- **配置位置**: 管理面板 (自动同步到数据库和Edge Functions)
- **获取方式**: https://serpapi.com
- **重要性**: ⚠️ 调用失败会导致功能报错
- **监控需求**: 需要监测剩余调用量，及时替换新API密钥
- **影响功能**:
  - 资料搜索 (research-retrieval-agent)
  - Google搜索 (serpapi-search)
  - AI搜索 (ai-search)

### 2. **INTEGRATIONS_API_KEY** (必需)
- **用途**: 调用 Gemini 服务 (通过 New API 中转站)
- **配置位置**: 管理面板 (自动同步到Edge Functions)
- **影响功能**:
  - 所有需要 Gemini LLM 的功能
  - 文章结构生成
  - 段落推理生成
  - 证据生成
  - 最终文本生成

### 3. **QIANWEN_API_KEY** (必需)
- **用途**: 调用通义千问API进行文本生成
- **配置位置**: 管理面板 (自动同步到数据库和Edge Functions)
- **获取方式**: https://cloud.siliconflow.cn
- **影响功能**:
  - 搜索计划生成
  - 资料整理
  - 所有LLM相关功能的备用方案

### 4. **RESEND_API_KEY** (可选)
- **用途**: 发送邀请邮件
- **配置位置**: Supabase Edge Functions Secrets (手动配置)
- **影响功能**: 邮件邀请功能 (send-invite-email)

### 5. **OPENAI_BASE_URL** (必需)
- **用途**: New API中转站地址
- **默认值**: `https://api.newapi.pro`
- **配置位置**: 环境变量
- **影响功能**: Gemini服务调用

## 📊 配置优先级

### 🔴 高优先级 (核心功能)
1. **SERPAPI_API_KEY** - 学术搜索核心功能，需监控剩余量
2. **QIANWEN_API_KEY** - LLM文本生成
3. **INTEGRATIONS_API_KEY** - Gemini服务
4. **OPENAI_BASE_URL** - API中转站

### 🟢 低优先级 (辅助功能)
5. **RESEND_API_KEY** - 邮件功能

## 🎯 Embedding 方案

**使用本地模型**: bge-base-zh-v1.5
- **实现方式**: Python + sentence-transformers
- **优势**: 无需API密钥，成本为零
- **部署**: 独立服务

## 🔧 配置方式

### 方式1: 管理面板配置 (推荐)
```
访问管理页面 → 系统配置
配置以下密钥:
- SERPAPI_API_KEY (必需)
- QIANWEN_API_KEY (必需)
- INTEGRATIONS_API_KEY (必需)

保存后自动同步到:
- 数据库 system_config 表
- Edge Functions Secrets
```

### 方式2: 手动配置 (仅 RESEND_API_KEY)
```
Supabase Dashboard → 项目设置 → Edge Functions → Secrets
添加: RESEND_API_KEY
```

## 🔍 SerpAPI 监控需求

### 为什么需要监控
- SerpAPI 有调用量限制
- 超限会导致搜索功能报错
- 需要及时替换新的API密钥

### 监控方案
1. **调用量统计**: 记录每次SerpAPI调用
2. **剩余量查询**: 定期查询SerpAPI账户剩余量
3. **告警机制**: 剩余量低于阈值时发送告警
4. **自动切换**: 支持配置多个API密钥，自动轮换使用

### 实现建议
```typescript
// 在 serpapi-search Edge Function 中添加
interface SerpAPIUsage {
  total_searches_left: number;
  plan_searches_left: number;
}

async function checkSerpAPIUsage(apiKey: string): Promise<SerpAPIUsage> {
  const response = await fetch(`https://serpapi.com/account?api_key=${apiKey}`);
  return response.json();
}
```

## ✅ 验证配置

运行测试脚本:
```bash
# 测试API服务器和New API
node tests/migration-test.js

# 测试SSE流式传输
node tests/test-sse.js
```

## 📝 注意事项

1. **所有核心API密钥** 都通过管理面板配置，自动同步
2. **SERPAPI_API_KEY** 是核心功能，必须监控使用量
3. **配置同步**: 管理面板保存后自动同步到数据库和Edge Functions
4. **Embedding**: 使用本地 bge-base-zh-v1.5 模型，无需API密钥
5. **多密钥支持**: 建议为SerpAPI配置多个密钥，实现自动轮换

## 🔗 相关文档

- [`API_KEY_SETUP.md`](API_KEY_SETUP.md) - 详细配置指南
- [`QUICK_SETUP_QIANWEN.md`](QUICK_SETUP_QIANWEN.md) - 通义千问快速配置
- [`SERPAPI_CONFIGURATION.md`](SERPAPI_CONFIGURATION.md) - SerpAPI配置说明
- [`CONFIGURE_SECRETS.md`](CONFIGURE_SECRETS.md) - Secrets配置步骤
