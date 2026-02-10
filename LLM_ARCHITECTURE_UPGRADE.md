# LLM 架构升级 - 双层模型系统

## 更新概述

CoWrite v138 引入了全新的**双层 LLM 架构**，大幅提升服务可用性和用户体验。

## 核心改进

### 1. 双层 LLM 架构 ✨

#### 第一层：内置 Gemini 模型（主要）
- **模型**: Google Gemini 2.5 Flash
- **端点**: `https://app-9bwpferlujnl-api-VaOwP8E7dJqa.gateway.appmedo.com/v1beta/models/gemini-2.5-flash:generateContent`
- **特点**: 
  - 系统内置，无需配置
  - 免费使用
  - 响应快速
  - 稳定可靠

#### 第二层：用户配置的 Qwen 模型（备用）
- **模型**: Qwen 2.5-7B-Instruct
- **端点**: `https://api.siliconflow.cn/v1/chat/completions`
- **特点**:
  - 需要管理员配置 API 密钥
  - 当 Gemini 不可用时自动切换
  - 高质量中文支持

### 2. 智能回退机制

```typescript
async function callLLM(options: LLMCallOptions): Promise<LLMResponse> {
  try {
    // 第一次尝试：调用内置 Gemini
    console.log("尝试调用内置 Gemini 模型...");
    const response = await callGemini(options);
    console.log("✓ Gemini 调用成功");
    return response;
  } catch (geminiError) {
    console.warn("Gemini 调用失败，尝试回退到 Qwen:", geminiError);
    
    try {
      // 第二次尝试：调用用户配置的 Qwen
      const apiKey = await getQwenApiKey();
      if (!apiKey) {
        throw new Error("Gemini 调用失败，且未配置 Qwen API 密钥");
      }
      
      console.log("尝试调用用户配置的 Qwen 模型...");
      const response = await callQwen(options, apiKey);
      console.log("✓ Qwen 调用成功（回退）");
      return response;
    } catch (qwenError) {
      console.error("Qwen 调用也失败:", qwenError);
      throw new Error("LLM 调用失败：Gemini 和 Qwen 均不可用");
    }
  }
}
```

### 3. 代码简化

#### 移除的功能
- ❌ OpenAI 集成（llm-generate 中的 OpenAI 调用代码）
- ❌ Anthropic 集成（llm-generate 中的 Claude 调用代码）
- ❌ Tavily Search Edge Function
- ❌ Smart Search Edge Function
- ❌ _shared 目录（改为内联代码）

#### 更新的 Edge Functions
1. **research-synthesis-agent**
   - 移除了 API 密钥检查逻辑
   - 集成双层 LLM 调用
   - 简化错误处理

2. **llm-generate**
   - 移除了多提供商支持（OpenAI、Anthropic、Qwen）
   - 统一使用双层 LLM 架构
   - 简化配置读取

3. **summarize-content**
   - 移除了环境变量依赖（LLM_API_KEY、LLM_API_URL、LLM_MODEL）
   - 统一使用双层 LLM 架构

#### 更新的前端代码
- **src/db/api.ts**
  - 移除了 `searchSmartSearch()` 函数
  - 更新了 `academicSearchWorkflow()` 中的搜索逻辑

## 用户体验改进

### 之前（v137 及更早）
```
用户请求 → 检查 API 密钥 → 未配置 → 返回错误 ❌
                ↓
              已配置
                ↓
         调用 Qwen API → 失败 → 返回错误 ❌
                ↓
              成功
                ↓
            返回结果 ✅
```

**问题**：
- 用户必须配置 API 密钥才能使用
- 单点故障：Qwen 不可用时整个服务不可用
- 配置复杂：需要注册 SiliconFlow、获取 API Key、配置系统

### 现在（v138+）
```
用户请求 → 尝试 Gemini → 成功 → 返回结果 ✅
                ↓
              失败
                ↓
         尝试 Qwen → 成功 → 返回结果 ✅
                ↓
              失败
                ↓
           返回错误 ❌
```

**优势**：
- ✅ 无需配置即可使用（Gemini 内置）
- ✅ 双重保障：一个模型不可用时自动切换
- ✅ 透明切换：用户无感知
- ✅ 降低成本：Gemini 免费使用

## 技术细节

### Gemini API 集成

#### 请求格式
```typescript
{
  "contents": [
    {
      "role": "user",
      "parts": [{ "text": "用户消息" }]
    }
  ],
  "systemInstruction": {
    "parts": [{ "text": "系统指令" }]
  },
  "generationConfig": {
    "temperature": 0.7,
    "maxOutputTokens": 4096
  }
}
```

#### 响应格式
```typescript
{
  "candidates": [
    {
      "content": {
        "parts": [
          { "text": "生成的内容" }
        ]
      }
    }
  ],
  "usageMetadata": {
    "promptTokenCount": 100,
    "candidatesTokenCount": 200,
    "totalTokenCount": 300
  }
}
```

### Qwen API 集成

#### 请求格式（OpenAI 兼容）
```typescript
{
  "model": "Qwen/Qwen2.5-7B-Instruct",
  "messages": [
    { "role": "system", "content": "系统指令" },
    { "role": "user", "content": "用户消息" }
  ],
  "temperature": 0.7,
  "max_tokens": 4096
}
```

#### 响应格式
```typescript
{
  "choices": [
    {
      "message": {
        "content": "生成的内容"
      }
    }
  ],
  "usage": {
    "prompt_tokens": 100,
    "completion_tokens": 200,
    "total_tokens": 300
  }
}
```

## 部署状态

### 已部署的 Edge Functions
- ✅ research-synthesis-agent (v138)
- ✅ llm-generate (v138)
- ✅ summarize-content (v138)

### 已删除的 Edge Functions
- ❌ tavily-search
- ❌ smart-search

### 前端代码
- ✅ src/db/api.ts (已更新)
- ✅ Lint 检查通过

## 测试建议

### 1. 测试 Gemini 主路径
1. 确保没有配置 Qwen API Key
2. 进入"知识研究"阶段
3. 点击"资料整理"按钮
4. 查看日志，应显示"✓ Gemini 调用成功"

### 2. 测试 Qwen 回退路径
1. 临时禁用 Gemini（修改 URL 或断网）
2. 配置 Qwen API Key
3. 点击"资料整理"按钮
4. 查看日志，应显示"✓ Qwen 调用成功（回退）"

### 3. 测试错误处理
1. 临时禁用 Gemini
2. 不配置 Qwen API Key
3. 点击"资料整理"按钮
4. 应显示友好的错误提示

## 监控和日志

### 查看 Edge Function 日志
1. 打开 Supabase Dashboard
2. 进入 Edge Functions → Logs
3. 查看以下关键日志：
   - `尝试调用内置 Gemini 模型...`
   - `✓ Gemini 调用成功`
   - `Gemini 调用失败，尝试回退到 Qwen`
   - `✓ Qwen 调用成功（回退）`

### 性能指标
- **Gemini 响应时间**: 通常 1-3 秒
- **Qwen 响应时间**: 通常 2-5 秒
- **回退延迟**: 约 1-2 秒（Gemini 超时后）

## 文档更新

### 已更新的文档
- ✅ API_KEY_SETUP.md - 完全重写，反映新架构
- ✅ TODO.md - 添加新架构说明
- ✅ SOLUTION_SUMMARY.md - 保留旧版说明作为参考

### 新增的文档
- ✅ LLM_ARCHITECTURE_UPGRADE.md - 本文档

## 向后兼容性

### 配置兼容性
- ✅ 已配置的 Qwen API Key 仍然有效
- ✅ 未配置 API Key 的用户现在可以直接使用（通过 Gemini）
- ✅ 管理面板的配置界面保持不变

### API 兼容性
- ✅ 所有前端 API 调用保持不变
- ✅ Edge Function 接口保持不变
- ✅ 数据库结构保持不变

## 未来改进

### 短期（v139）
- [ ] 添加模型使用统计（Gemini vs Qwen 使用比例）
- [ ] 在管理面板显示当前使用的模型
- [ ] 添加模型切换的用户通知

### 中期（v140-v141）
- [ ] 支持更多 Gemini 模型（如 Gemini Pro）
- [ ] 添加模型性能监控
- [ ] 实现智能模型选择（根据任务类型）

### 长期（v142+）
- [ ] 支持用户自定义模型优先级
- [ ] 添加模型 A/B 测试功能
- [ ] 实现模型负载均衡

## 总结

CoWrite v138 的 LLM 架构升级是一次重大改进：

1. **用户体验**：从"必须配置"到"开箱即用"
2. **可用性**：从"单点故障"到"双重保障"
3. **成本**：从"需要付费 API"到"免费使用"
4. **维护性**：从"多提供商复杂逻辑"到"统一双层架构"

这次升级为 CoWrite 的长期发展奠定了坚实的基础。

---

**更新时间**: 2025-02-10  
**版本**: v138  
**状态**: ✅ 已完成并部署
