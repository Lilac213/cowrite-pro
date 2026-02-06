# 调试指南 - 资料搜索失败问题

## 问题现象
用户在进行资料搜索时，看到错误提示：
- 阶段：未知阶段 或 资料整理
- 错误信息：Edge Function returned a non-2xx status code

## 已实施的改进

### 1. 增强的错误提取逻辑

在 `src/db/api.ts` 中改进了两个关键函数的错误处理：

#### researchRetrievalAgent
```typescript
// 改进前：只显示 error.message
throw new Error(`资料检索失败: ${error.message}`);

// 改进后：尝试多种方式提取详细错误
- 从 error.message 提取
- 从 error.context 提取（支持字符串和 Response 对象）
- 从 data.error 提取（Edge Function 返回的错误）
```

#### researchSynthesisAgent
```typescript
// 同样的改进逻辑
- 提取 Edge Function 返回的详细错误信息
- 支持 JSON 格式和纯文本格式的错误
```

### 2. 详细的控制台日志

在 `src/components/workflow/KnowledgeStage.tsx` 中添加了详细的调试日志：

```typescript
console.error('搜索失败 - 完整错误对象:', error);
console.error('错误类型:', typeof error);
console.error('错误属性:', Object.keys(error));
console.error('错误消息:', errorMessage);
console.error('发现 error.context');
console.error('context 文本:', contextText);
console.error('解析后的错误:', errorMessage);
```

## 如何使用调试功能

### 步骤 1: 打开浏览器开发者工具
1. 按 F12 或右键点击页面 → 检查
2. 切换到 "Console" 标签

### 步骤 2: 执行搜索操作
1. 在应用中输入搜索内容
2. 点击"智能搜索"按钮
3. 观察进度显示和控制台输出

### 步骤 3: 查看详细错误信息

当搜索失败时，控制台会显示：

```
搜索失败 - 完整错误对象: {message: "...", context: ...}
错误类型: object
错误属性: ["message", "context", ...]
错误消息: API密钥未配置
发现 error.context
context 文本: {"error": "API密钥未配置"}
解析后的错误: API密钥未配置
```

## 常见错误及解决方案

### 错误 1: API密钥未配置
**错误信息**: `API密钥未配置` 或 `INTEGRATIONS_API_KEY is not set`

**原因**: Edge Function 无法获取 INTEGRATIONS_API_KEY 环境变量

**解决方案**:
1. 检查 Supabase 项目的 Secrets 配置
2. 确保 INTEGRATIONS_API_KEY 已正确设置
3. 重新部署 Edge Functions

### 错误 2: LLM API 请求失败
**错误信息**: `LLM API 请求失败: 401` 或 `LLM API 请求失败: 403`

**原因**: API 密钥无效或已过期

**解决方案**:
1. 验证 INTEGRATIONS_API_KEY 的有效性
2. 检查 API 配额是否已用完
3. 更新 API 密钥

### 错误 3: 解析整理结果失败 / JSON 解析错误
**错误信息**: 
- `解析整理结果失败: Unexpected token`
- `Expected double-quoted property name in JSON at position XXX`
- `Unexpected token in JSON at position XXX`

**原因**: LLM 返回的内容不是有效的 JSON 格式

**已实施的自动修复**:
系统现在会自动尝试修复以下常见的 JSON 错误：
1. 移除 JSON 注释（`//` 和 `/* */`）
2. 移除尾随逗号（如 `{"key": "value",}` → `{"key": "value"}`）
3. 修复未加引号的属性名（如 `{name: "value"}` → `{"name": "value"}`）
4. 修复缺少逗号的情况：
   - 字符串值后直接跟属性名：`"value" "key":` → `"value", "key":`
   - 数字/布尔值后直接跟属性名：`123 "key":` → `123, "key":`
   - 对象/数组结束后直接跟属性名：`{} "key":` → `{}, "key":`
5. 移除多余的连续逗号（如 `{"a":"b",,,"c":"d"}` → `{"a":"b","c":"d"}`）

**如果自动修复失败**:
1. 检查 Edge Function 日志中的详细错误信息
2. 查看 "提取的 JSON 文本" 和 "修复后的 JSON 文本" 日志
3. 查看 "错误位置附近的内容" 以定位具体问题
4. 可能需要调整 LLM prompt 以确保返回正确的 JSON 格式

**调试步骤**:
1. 在 Supabase Dashboard → Edge Functions → Logs 中查看详细日志
2. 找到 "提取的 JSON 文本（前1000字符）" 日志条目
3. 复制 JSON 文本到 JSON 验证工具（如 jsonlint.com）检查具体错误
4. 如果是 LLM 输出格式问题，可能需要调整 system prompt

### 错误 4: 缺少检索结果或需求文档
**错误信息**: `缺少检索结果或需求文档`

**原因**: 传递给 Edge Function 的参数不完整

**解决方案**:
1. 检查需求文档是否已创建
2. 确保 retrievalResults 不为空
3. 验证数据传递流程

## 进度显示说明

搜索过程会显示以下阶段：

1. **准备中**: 初始化搜索
2. **读取需求**: 读取需求文档
3. **资料查询**: 从 5 个数据源检索
   - Google Scholar
   - TheNews
   - Smart Search
   - 参考文章库
   - 个人素材库
4. **资料整理**: 整理检索结果
5. **保存资料**: 保存到知识库
6. **完成**: 搜索成功完成

如果在某个阶段失败，进度显示会标记为"失败"并显示具体的错误信息。

## 检查 Edge Function 日志

如果需要查看 Edge Function 的详细日志：

1. 登录 Supabase Dashboard
2. 进入项目 → Edge Functions
3. 选择对应的函数（research-retrieval-agent 或 research-synthesis-agent）
4. 查看 Logs 标签
5. 查找错误信息和堆栈跟踪

## 测试建议

### 测试 1: 验证 API 密钥
```bash
# 在 Supabase Dashboard 的 SQL Editor 中执行
SELECT * FROM vault.secrets WHERE name = 'INTEGRATIONS_API_KEY';
```

### 测试 2: 手动调用 Edge Function
```javascript
// 在浏览器控制台中执行
const { data, error } = await supabase.functions.invoke('research-synthesis-agent', {
  body: {
    retrievalResults: { test: 'data' },
    requirementsDoc: { 主题: '测试' }
  }
});
console.log('Data:', data);
console.log('Error:', error);
```

### 测试 3: 检查网络请求
1. 打开开发者工具 → Network 标签
2. 执行搜索操作
3. 查找 research-retrieval-agent 和 research-synthesis-agent 请求
4. 检查请求和响应的详细信息

## 下一步行动

如果问题仍然存在，请提供以下信息：

1. **控制台日志**: 完整的错误日志输出
2. **网络请求**: Edge Function 请求和响应的详细信息
3. **进度阶段**: 在哪个阶段失败
4. **错误消息**: 显示的具体错误信息
5. **Edge Function 日志**: 从 Supabase Dashboard 获取的日志

这些信息将帮助我们更准确地定位和解决问题。
