# 🔍 搜索功能调试指南

## 问题描述

用户报告搜索功能无法返回数据。为了诊断问题，我们添加了详细的调试日志和专用的调试页面。

## 🛠️ 调试工具

### 1. 搜索调试页面

**访问地址**: `/search-debug`

这是一个专门的调试页面，提供以下功能：

- ✅ 实时显示搜索流程日志
- ✅ 显示详细的搜索结果
- ✅ 显示原始 API 响应数据
- ✅ 显示错误信息和堆栈跟踪
- ✅ 可自定义需求文档进行测试

**使用步骤**:

1. 访问 `/search-debug` 页面
2. 查看默认的需求文档（或修改为自己的测试数据）
3. 点击"开始搜索"按钮
4. 观察执行日志和搜索结果
5. 如果出现错误，查看错误信息和原始响应数据

### 2. Edge Function 详细日志

我们在 `research-retrieval-agent` Edge Function 中添加了详细的调试日志：

**日志内容包括**:

```
========== API Keys 状态检查 ==========
- QIANWEN_API_KEY 存在、长度、前缀
- INTEGRATIONS_API_KEY 存在、长度、前缀

========== Google Scholar 搜索开始 ==========
- 查询关键词
- 请求 URL
- 响应状态码
- 原始响应内容（前 500 字符）
- 解析后的数据结构
- organic_results 是否存在
- 结果数量
- 第一条结果示例
- 映射后的结果数量

========== TheNews 搜索开始 ==========
- 查询关键词
- 请求 URL
- 响应状态码
- 原始响应内容
- data 字段是否存在
- 结果数量
- 映射后的结果数量

========== Smart Search 搜索开始 ==========
- 查询关键词
- 请求 URL
- 响应状态码
- 原始响应内容
- webPages.value 是否存在
- 结果数量
- 映射后的结果数量

========== 等待所有搜索完成 ==========
- 搜索任务数量
- 各数据源结果数量

========== 开始去重 ==========
- 去重前数量
- 去重后数量

========== 最终结果统计 ==========
- 总计资料数量
- 各数据源详细统计
- 示例数据
```

**查看日志**:

1. 登录 Supabase Dashboard
2. 进入项目：`app-9bwpferlujnl`
3. 导航到：Edge Functions → research-retrieval-agent → Logs
4. 查看最近的日志输出

## 🔍 诊断步骤

### 步骤 1: 检查 API Keys 配置

**在调试页面**:
- 点击"开始搜索"
- 查看执行日志中是否出现 "QIANWEN_API_KEY 未配置" 或 "INTEGRATIONS_API_KEY 未配置"

**在 Edge Function 日志**:
- 查找 "API Keys 状态检查" 部分
- 确认两个 API Key 都存在且有正确的长度

**预期结果**:
```
QIANWEN_API_KEY 存在: true
QIANWEN_API_KEY 长度: 40+
INTEGRATIONS_API_KEY 存在: true
INTEGRATIONS_API_KEY 长度: 20+
```

**如果失败**:
- QIANWEN_API_KEY: 访问 `/admin` → 系统配置 → LLM 配置，确认已配置
- INTEGRATIONS_API_KEY: 联系平台管理员在 Supabase Dashboard 中配置

### 步骤 2: 检查搜索计划生成

**在调试页面**:
- 查看日志中是否有 "✅ Edge Function 调用成功"
- 查看是否显示了搜索摘要（理解的主题、关键维度）

**在 Edge Function 日志**:
- 查找 "通义千问返回内容"
- 查找 "搜索计划"
- 确认 academic_queries、news_queries、web_queries 都有值

**预期结果**:
```json
{
  "search_summary": {
    "interpreted_topic": "AI Agent应用的商业化路径",
    "key_dimensions": ["商业化策略", "用户定位"]
  },
  "academic_queries": ["AI Agent commercialization", "target user positioning"],
  "news_queries": ["AI Agent商业化", "AI应用市场"],
  "web_queries": ["AI Agent案例", "商业化路径"]
}
```

**如果失败**:
- 检查通义千问 API 是否返回错误
- 检查 API Key 是否有效
- 检查账户余额

### 步骤 3: 检查各数据源搜索

**在 Edge Function 日志中查找**:

#### Google Scholar
```
[Google Scholar] 查询: "AI Agent commercialization"
[Google Scholar] URL: https://...
[Google Scholar] 响应状态: 200
[Google Scholar] organic_results 存在: true
[Google Scholar] organic_results 长度: 10
```

**可能的问题**:
- 响应状态不是 200 → API Gateway 问题或 INTEGRATIONS_API_KEY 无效
- organic_results 不存在 → API 响应格式变化
- organic_results 长度为 0 → 没有搜索结果（可能是查询词问题）

#### TheNews
```
[TheNews] 查询: "AI Agent商业化"
[TheNews] URL: https://...
[TheNews] 响应状态: 200
[TheNews] data 字段存在: true
[TheNews] data 长度: 5
```

**可能的问题**:
- 响应状态不是 200 → API 问题
- data 字段不存在 → API 响应格式变化
- data 长度为 0 → 没有新闻结果

#### Smart Search
```
[Smart Search] 查询: "AI Agent案例"
[Smart Search] URL: https://...
[Smart Search] 响应状态: 200
[Smart Search] webPages.value 存在: true
[Smart Search] webPages.value 长度: 5
```

**可能的问题**:
- 响应状态不是 200 → Bing API 问题
- webPages.value 不存在 → API 响应格式变化
- webPages.value 长度为 0 → 没有网络搜索结果

### 步骤 4: 检查最终结果

**在调试页面**:
- 查看 "📊 搜索结果统计"
- 确认各数据源的结果数量
- 查看实际显示的搜索结果卡片

**在 Edge Function 日志**:
- 查找 "最终结果统计"
- 确认总计资料数量

**预期结果**:
```
学术来源数量: 5-10
新闻来源数量: 5-10
网络来源数量: 5-10
总计: 15-30
```

**如果结果为 0**:
- 检查上述每个数据源的日志
- 查看是否有错误信息
- 检查原始响应数据

## 🐛 常见问题和解决方案

### 问题 1: INTEGRATIONS_API_KEY 未配置

**症状**:
- 调试页面显示错误: "INTEGRATIONS_API_KEY 未配置"
- Edge Function 日志显示: "INTEGRATIONS_API_KEY 存在: false"

**解决方案**:
1. 这是平台级密钥，需要平台管理员配置
2. 联系平台管理员
3. 提供项目 ID: `app-9bwpferlujnl`
4. 请求配置 INTEGRATIONS_API_KEY

### 问题 2: 所有搜索结果都为空

**症状**:
- Edge Function 调用成功
- 但所有数据源结果数量都是 0

**可能原因**:
1. **INTEGRATIONS_API_KEY 无效**
   - 检查 Edge Function 日志中的响应状态码
   - 如果是 401/403，说明密钥无效

2. **API 响应格式变化**
   - 查看 Edge Function 日志中的原始响应
   - 对比代码中的字段映射逻辑
   - 可能需要更新字段名称

3. **搜索关键词问题**
   - 查看生成的搜索计划
   - 确认关键词是否合理
   - 尝试手动修改关键词测试

### 问题 3: 只有部分数据源有结果

**症状**:
- Google Scholar 有结果，但 TheNews 和 Smart Search 没有

**可能原因**:
1. **不同 API 的可用性不同**
   - 某些 API 可能暂时不可用
   - 查看该 API 的响应状态码和错误信息

2. **查询词不匹配**
   - 某些数据源对特定类型的查询词更敏感
   - 尝试调整查询词

### 问题 4: 搜索计划生成失败

**症状**:
- 调试页面显示错误: "解析搜索计划失败"
- Edge Function 日志显示 JSON 解析错误

**可能原因**:
1. **通义千问返回格式不正确**
   - 查看 "通义千问返回内容" 日志
   - 确认是否包含 ---JSON--- 标记
   - 确认 JSON 格式是否正确

2. **API 配额用完**
   - 检查阿里云控制台的 API 调用统计
   - 确认账户余额

## 📊 调试检查清单

使用此清单系统地排查问题：

- [ ] **API Keys 配置**
  - [ ] QIANWEN_API_KEY 已配置
  - [ ] INTEGRATIONS_API_KEY 已配置
  - [ ] 两个 Key 都有正确的长度和格式

- [ ] **搜索计划生成**
  - [ ] 通义千问 API 调用成功
  - [ ] 返回内容包含 ---JSON--- 标记
  - [ ] JSON 解析成功
  - [ ] academic_queries 有值
  - [ ] news_queries 有值
  - [ ] web_queries 有值

- [ ] **Google Scholar 搜索**
  - [ ] API 请求发送成功
  - [ ] 响应状态码为 200
  - [ ] organic_results 字段存在
  - [ ] 结果数量 > 0
  - [ ] 数据映射成功

- [ ] **TheNews 搜索**
  - [ ] API 请求发送成功
  - [ ] 响应状态码为 200
  - [ ] data 字段存在
  - [ ] 结果数量 > 0
  - [ ] 数据映射成功

- [ ] **Smart Search 搜索**
  - [ ] API 请求发送成功
  - [ ] 响应状态码为 200
  - [ ] webPages.value 字段存在
  - [ ] 结果数量 > 0
  - [ ] 数据映射成功

- [ ] **最终结果**
  - [ ] 去重成功
  - [ ] 总计结果数量 > 0
  - [ ] 前端正确显示结果

## 🔧 高级调试技巧

### 1. 使用浏览器开发者工具

打开浏览器控制台（F12），查看：

- **Console 标签**: 前端日志和错误
- **Network 标签**: 
  - 找到 `research-retrieval-agent` 请求
  - 查看请求体（Request Payload）
  - 查看响应体（Response）
  - 查看响应时间

### 2. 直接测试 API

使用 curl 或 Postman 直接测试各个 API：

```bash
# 测试 Google Scholar
curl "https://app-9bwpferlujnl-api-Xa6JZq2055oa.gateway.appmedo.com/search?engine=google_scholar&q=AI+Agent&as_ylo=2020&hl=en" \
  -H "X-Gateway-Authorization: Bearer YOUR_INTEGRATIONS_API_KEY"

# 测试 TheNews
curl "https://app-9bwpferlujnl-api-W9z3M6eOKQVL.gateway.appmedo.com/v1/news/all?api_token=dummy&search=AI+Agent&limit=5" \
  -H "X-Gateway-Authorization: Bearer YOUR_INTEGRATIONS_API_KEY"

# 测试 Smart Search
curl "https://app-9bwpferlujnl-api-VaOwP8E7dKEa.gateway.appmedo.com/search/FgEFxazBTfRUumJx/smart?q=AI+Agent&count=5" \
  -H "X-Gateway-Authorization: Bearer YOUR_INTEGRATIONS_API_KEY"
```

### 3. 修改搜索关键词

在调试页面中，尝试不同的需求文档：

```json
{
  "主题": "人工智能",
  "关键要点": ["机器学习", "深度学习"],
  "核心观点": ["AI发展趋势"],
  "目标读者": "技术人员",
  "写作风格": "技术",
  "预期长度": "短"
}
```

### 4. 逐个测试数据源

修改 Edge Function 代码，暂时注释掉某些数据源，逐个测试：

```typescript
// 只测试 Google Scholar
if (searchPlan.academic_queries && searchPlan.academic_queries.length > 0) {
  // ... Google Scholar 搜索代码
}

// 暂时注释掉其他数据源
// if (searchPlan.news_queries && searchPlan.news_queries.length > 0) { ... }
// if (searchPlan.web_queries && searchPlan.web_queries.length > 0) { ... }
```

## 📝 报告问题

如果问题仍未解决，请收集以下信息：

1. **调试页面截图**
   - 执行日志
   - 错误信息
   - 搜索结果统计

2. **Edge Function 日志**
   - 完整的日志输出
   - 特别是错误信息和原始响应

3. **测试的需求文档**
   - 使用的 JSON 内容

4. **环境信息**
   - 浏览器类型和版本
   - 用户角色（管理员/普通用户）
   - 测试时间

## 🎯 下一步

1. **访问调试页面**: `/search-debug`
2. **执行测试搜索**
3. **查看日志和结果**
4. **根据上述检查清单排查问题**
5. **如需帮助，提供完整的日志信息**

---

**更新时间**: 2025-02-06
**版本**: 1.0
**状态**: ✅ 调试工具已部署
