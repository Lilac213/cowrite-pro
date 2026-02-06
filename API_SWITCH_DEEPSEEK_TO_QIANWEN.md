# 🔄 API 切换说明：从 DeepSeek 到通义千问

## 更新内容

### 变更时间
2025-02-06

### 变更原因
CoWrite 系统使用通义千问（Qianwen）作为 LLM 服务提供商，而不是 DeepSeek。

### 具体变更

#### 1. 环境变量
```
旧版: DEEPSEEK_API_KEY
新版: QIANWEN_API_KEY
```

#### 2. API 端点
```
旧版: https://api.deepseek.com/v1/chat/completions
新版: https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions
```

#### 3. 模型名称
```
旧版: deepseek-chat
新版: qwen-plus
```

#### 4. 受影响的 Edge Functions
- ✅ research-retrieval-agent
- ✅ research-synthesis-agent

## 配置步骤

### 1. 获取通义千问 API Key

1. 访问阿里云控制台：https://dashscope.console.aliyun.com/
2. 登录您的阿里云账号
3. 进入"API-KEY 管理"
4. 创建新的 API Key 或使用现有的
5. 复制 API Key

### 2. 在 Supabase 中配置

1. 打开 Supabase Dashboard
2. 进入 Settings → Edge Functions → Environment Variables
3. 添加新的环境变量：
   - Name: `QIANWEN_API_KEY`
   - Value: 您的通义千问 API Key
4. 保存

### 3. 验证配置

运行测试搜索，确认不再出现 "DEEPSEEK_API_KEY 未配置" 错误。

## 通义千问 API 特点

### 优势
- ✅ 中文理解能力强
- ✅ 响应速度快
- ✅ 价格合理
- ✅ 稳定性高
- ✅ OpenAI 兼容模式，易于集成

### 可用模型
- `qwen-turbo`: 快速响应，适合简单任务
- `qwen-plus`: 平衡性能和成本（当前使用）
- `qwen-max`: 最强性能，适合复杂任务

### API 限制
- 请求频率限制：根据您的套餐
- Token 限制：
  - qwen-turbo: 8k tokens
  - qwen-plus: 32k tokens
  - qwen-max: 32k tokens

## 兼容性说明

### OpenAI 兼容模式
通义千问提供 OpenAI 兼容的 API 端点，因此代码改动最小：
- 相同的请求格式
- 相同的响应格式
- 只需更改端点和 API Key

### 代码变更
```typescript
// 旧版
const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
  headers: {
    'Authorization': `Bearer ${deepseekApiKey}`
  },
  body: JSON.stringify({
    model: 'deepseek-chat',
    ...
  })
});

// 新版
const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
  headers: {
    'Authorization': `Bearer ${qianwenApiKey}`
  },
  body: JSON.stringify({
    model: 'qwen-plus',
    ...
  })
});
```

## 故障排查

### 错误：QIANWEN_API_KEY 未配置

**解决方案**：
1. 确认已在 Supabase Dashboard 中添加 `QIANWEN_API_KEY` 环境变量
2. 确认 API Key 格式正确（通常以 `sk-` 开头）
3. 重新部署 Edge Functions（如果刚添加环境变量）

### 错误：通义千问 API 请求失败: 401

**原因**：API Key 无效或已过期

**解决方案**：
1. 检查 API Key 是否正确
2. 在阿里云控制台确认 API Key 状态
3. 如果过期，生成新的 API Key

### 错误：通义千问 API 请求失败: 429

**原因**：请求频率超过限制

**解决方案**：
1. 检查您的套餐限制
2. 实现请求缓存
3. 添加请求队列
4. 考虑升级套餐

### 错误：通义千问 API 返回内容为空

**原因**：API 响应格式不符合预期

**解决方案**：
1. 查看 Edge Function 日志
2. 检查 API 响应的完整内容
3. 确认模型名称正确（qwen-plus）

## 性能对比

### DeepSeek vs 通义千问

| 指标 | DeepSeek | 通义千问 (qwen-plus) |
|-----|----------|---------------------|
| 中文理解 | 良好 | 优秀 |
| 响应速度 | 2-5秒 | 1-3秒 |
| Token 限制 | 32k | 32k |
| 价格 | 中等 | 中等 |
| 稳定性 | 良好 | 优秀 |

## 相关文档

- [通义千问官方文档](https://help.aliyun.com/zh/dashscope/)
- [API 参考](https://help.aliyun.com/zh/dashscope/developer-reference/api-details)
- [定价说明](https://help.aliyun.com/zh/dashscope/developer-reference/tongyi-qianwen-metering-and-billing)

## 后续优化建议

### 1. 模型选择优化
根据不同任务选择不同模型：
- 搜索计划生成：qwen-plus（当前）
- 资料整理：qwen-plus（当前）
- 简单任务：可考虑 qwen-turbo 降低成本

### 2. 参数调优
```typescript
{
  model: 'qwen-plus',
  temperature: 0.7,  // 可调整：0.1-1.0
  max_tokens: 2000,  // 可调整：根据需要
  top_p: 0.9,        // 可添加：控制采样
}
```

### 3. 错误重试
```typescript
async function callQianwenWithRetry(prompt, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await callQianwen(prompt);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await sleep(1000 * (i + 1)); // 指数退避
    }
  }
}
```

### 4. 响应缓存
```typescript
const cacheKey = `qianwen:${hash(prompt)}`;
const cached = await cache.get(cacheKey);
if (cached) return cached;

const result = await callQianwen(prompt);
await cache.set(cacheKey, result, 3600);
return result;
```

---

**更新状态**：✅ 已完成
**部署状态**：✅ 已部署
**测试状态**：⏳ 待用户验证
