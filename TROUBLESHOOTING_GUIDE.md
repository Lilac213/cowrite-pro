# 🔍 故障排查指南

## 快速诊断

### 问题 1: "解析搜索计划失败"

**完整错误信息**：
```
解析搜索计划失败: 未找到 ---JSON--- 标记
```

**可能原因**：
1. DeepSeek API 没有按照要求的格式输出
2. DeepSeek API 调用失败
3. System prompt 没有正确传递

**排查步骤**：

#### 步骤 1: 查看 raw_content
```typescript
// 在前端代码中
const result = await supabase.functions.invoke('research-retrieval-agent', {...});
console.log('LLM 原始输出:', result.data.raw_content);
```

**期望看到**：
```
---THOUGHT---
（思考过程）

---JSON---
{
  "search_summary": {...},
  ...
}
```

**如果看到**：
- 没有 `---JSON---` 标记 → DeepSeek 没有遵守格式
- 完全是错误信息 → DeepSeek API 调用失败
- 空内容 → API 密钥或网络问题

#### 步骤 2: 查看 Edge Function 日志
```
Supabase Dashboard → Edge Functions → research-retrieval-agent → Logs
```

**查找关键信息**：
- "开始调用 DeepSeek API..."
- "DeepSeek 返回内容: ..."
- "提取的 JSON 文本: ..."

#### 步骤 3: 检查环境变量
```bash
# 在 Supabase Dashboard 中
Settings → Edge Functions → Environment Variables
```

**确认存在**：
- `DEEPSEEK_API_KEY`
- `INTEGRATIONS_API_KEY`

#### 步骤 4: 测试 DeepSeek API
```bash
curl -X POST https://api.deepseek.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "deepseek-chat",
    "messages": [
      {"role": "user", "content": "Hello"}
    ]
  }'
```

---

### 问题 2: "整理结果失败"

**完整错误信息**：
```
整理结果失败: 未找到 ---JSON--- 标记
```

**排查步骤**：与问题 1 相同，但针对 `research-synthesis-agent`

---

### 问题 3: API 搜索失败

**错误信息示例**：
```
Google Scholar 搜索失败: ...
TheNews 搜索失败: ...
Smart Search 搜索失败: ...
```

**重要提示**：这些错误不会导致整个搜索失败，只是减少结果数量

**排查步骤**：

#### 步骤 1: 查看具体错误
```
Edge Function 日志 → 搜索 "搜索失败"
```

**常见错误**：
- `401 Unauthorized` → API 密钥无效
- `403 Forbidden` → API 密钥权限不足
- `429 Too Many Requests` → API 调用频率超限
- `500 Internal Server Error` → API 服务器错误
- `Network error` → 网络连接问题

#### 步骤 2: 测试 API 端点
```bash
# Google Scholar
curl -H "X-Gateway-Authorization: Bearer YOUR_KEY" \
  "https://app-9bwpferlujnl-api-Xa6JZq2055oa.gateway.appmedo.com/search?engine=google_scholar&q=test"

# TheNews
curl -H "X-Gateway-Authorization: Bearer YOUR_KEY" \
  "https://app-9bwpferlujnl-api-W9z3M6eOKQVL.gateway.appmedo.com/v1/news/all?api_token=dummy&search=test&limit=5"

# Smart Search
curl -H "X-Gateway-Authorization: Bearer YOUR_KEY" \
  "https://app-9bwpferlujnl-api-VaOwP8E7dKEa.gateway.appmedo.com/search/FgEFxazBTfRUumJx/smart?q=test"
```

#### 步骤 3: 检查 API 密钥
```
Supabase Dashboard → Settings → Edge Functions → Environment Variables
确认 INTEGRATIONS_API_KEY 存在且有效
```

---

### 问题 4: 搜索结果为空

**现象**：搜索成功，但所有数据源都返回空数组

**可能原因**：
1. 所有外部 API 调用都失败了
2. 搜索查询不合适，没有找到相关结果
3. API 返回的数据格式不符合预期

**排查步骤**：

#### 步骤 1: 查看搜索计划
```typescript
console.log('搜索计划:', result.data.search_summary);
console.log('学术查询:', result.data.academic_queries);
console.log('新闻查询:', result.data.news_queries);
console.log('网络查询:', result.data.web_queries);
```

**检查**：
- 查询是否为空？
- 查询是否合理？

#### 步骤 2: 查看 API 调用日志
```
Edge Function 日志 → 搜索 "返回"
```

**查找**：
- "Google Scholar 返回: ..."
- "TheNews 返回: ..."
- "Smart Search 返回: ..."

**检查**：
- API 是否返回了数据？
- 数据格式是否正确？

#### 步骤 3: 手动测试查询
使用搜索计划中的查询，手动调用 API，查看返回结果

---

## 常见问题 FAQ

### Q1: 为什么有时候搜索成功，有时候失败？

**A**: 可能的原因：
1. DeepSeek API 的输出不稳定（虽然新版已经大幅改善）
2. 外部 API 的可用性波动
3. 网络连接不稳定

**建议**：
- 实现重试机制
- 监控 API 成功率
- 考虑添加缓存

### Q2: 如何提高搜索结果的质量？

**A**: 
1. 优化需求文档的编写
2. 调整 prompt 中的搜索策略说明
3. 增加更多数据源
4. 实现结果排序和过滤

### Q3: 如何处理 API 调用频率限制？

**A**:
1. 实现请求缓存
2. 添加请求队列
3. 使用指数退避重试
4. 考虑升级 API 套餐

### Q4: 如何监控系统健康状况？

**A**:
1. 定期检查 Edge Function 日志
2. 监控 API 成功率
3. 跟踪 JSON 解析成功率
4. 设置告警机制

---

## 调试技巧

### 技巧 1: 使用 raw_content 字段
```typescript
// 总是记录 raw_content
console.log('LLM 原始输出:', result.data.raw_content);

// 检查是否包含 ---JSON--- 标记
if (!result.data.raw_content.includes('---JSON---')) {
  console.error('LLM 没有按照格式输出');
}
```

### 技巧 2: 逐步调试
```typescript
// 1. 先测试 Research Retrieval Agent
const retrievalResult = await testRetrievalAgent();
console.log('检索结果:', retrievalResult);

// 2. 再测试 Research Synthesis Agent
const synthesisResult = await testSynthesisAgent(retrievalResult);
console.log('整理结果:', synthesisResult);
```

### 技巧 3: 模拟 LLM 输出
```typescript
// 创建一个符合格式的测试输出
const mockLLMOutput = `
---THOUGHT---
这是测试输出

---JSON---
{
  "search_summary": {
    "interpreted_topic": "测试主题",
    "key_dimensions": ["维度1"]
  },
  "academic_queries": ["test query"],
  "news_queries": ["test query"],
  "web_queries": ["test query"]
}
`;

// 测试 JSON 提取逻辑
const jsonMatch = mockLLMOutput.match(/---JSON---\s*([\s\S]*?)(?:---|\n\n\n|$)/);
console.log('提取的 JSON:', jsonMatch[1]);
```

### 技巧 4: 监控 API 响应时间
```typescript
const startTime = Date.now();
const result = await supabase.functions.invoke('research-retrieval-agent', {...});
const endTime = Date.now();
console.log('响应时间:', endTime - startTime, 'ms');
```

---

## 性能优化建议

### 1. 实现缓存
```typescript
// 缓存搜索结果
const cacheKey = `search:${hash(requirementsDoc)}`;
const cached = await cache.get(cacheKey);
if (cached) return cached;

const result = await performSearch();
await cache.set(cacheKey, result, 3600); // 缓存1小时
return result;
```

### 2. 并行优化
```typescript
// 已经实现了并行搜索
// 可以进一步优化：添加超时控制
const searchWithTimeout = (promise, timeout) => {
  return Promise.race([
    promise,
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout')), timeout)
    )
  ]);
};
```

### 3. 结果预处理
```typescript
// 在返回前进行预处理
const preprocessResults = (results) => {
  return {
    ...results,
    academic_sources: results.academic_sources
      .filter(item => item.citation_count > 10) // 过滤低引用
      .sort((a, b) => b.citation_count - a.citation_count), // 按引用排序
    // ... 其他预处理
  };
};
```

---

## 联系支持

如果以上方法都无法解决问题：

1. **收集信息**：
   - 完整的错误信息
   - `raw_content` 字段内容
   - Edge Function 日志
   - 复现步骤

2. **检查文档**：
   - [100% 搜索成功率实现方案](./100_PERCENT_SUCCESS_IMPLEMENTATION.md)
   - [新版搜索系统快速参考](./NEW_SEARCH_SYSTEM_QUICK_REFERENCE.md)
   - [架构图](./ARCHITECTURE_DIAGRAM.md)

3. **提交问题**：
   - 包含所有收集的信息
   - 说明已尝试的解决方法
   - 提供复现环境
