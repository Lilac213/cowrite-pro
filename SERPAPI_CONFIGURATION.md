# SerpAPI 配置文档

## 配置完成

### 1. SerpAPI 密钥配置

**API Key**: `8ace4f21150845468c8386f82216a23fbd79a836c101b9265b7b8cfec673059a`

**配置位置**:
1. ✅ Supabase Edge Function Secrets: `SERPAPI_API_KEY`
2. ✅ 数据库 system_config 表: `search_api_key`

### 2. 支持的搜索引擎

通过 SerpAPI 统一调用以下 Google 搜索服务：

- **统一入口**: `serpapi-search` Edge Function
  - 支持单引擎和多引擎并行搜索
  - 内部使用 Promise.all 实现并行调用

- **Google Scholar**: 学术文献搜索
  - 引擎标识: `scholar`
  - 用途: 检索学术论文、引用数据

- **Google Search**: 网页搜索
  - 引擎标识: `search`
  - 用途: 检索网页内容、通用信息

- **Google News**: 新闻搜索
  - 引擎标识: `news`
  - 用途: 检索最新新闻资讯

### 3. 配置架构

#### 双层配置机制

系统采用双层配置机制，确保高可用性：

```
第一层: Edge Function 环境变量 (SERPAPI_API_KEY)
  ↓ (如果未配置)
第二层: 数据库 system_config 表 (search_api_key)
```

**优势**:
- 环境变量优先，性能更好
- 数据库作为备用，配置更灵活
- 管理员可通过管理面板实时更新配置

#### 配置流程

```
管理员在管理面板输入 API Key
  ↓
保存到数据库 system_config 表
  ↓
调用 sync-config-to-secrets Edge Function
  ↓
尝试同步到 Supabase Management API
  ↓
Edge Functions 读取配置（优先环境变量，回退到数据库）
```

### 4. 管理面板改进

#### 修复的问题
- ✅ SerpAPI 配置现在可以正常保存
- ✅ 显示当前配置状态（已配置/未配置）
- ✅ 显示 API Key 的部分内容（前20位...后10位）
- ✅ 保存后自动重新加载配置
- ✅ 更好的成功/失败提示

#### 新增功能

**配置状态显示**:
```tsx
{systemConfig.search_api_key && (
  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
    <div className="flex items-center gap-2">
      <span>✓</span>
      <span>SerpAPI 已启用</span>
    </div>
    <p className="text-xs">
      API Key: {systemConfig.search_api_key.substring(0, 20)}...
    </p>
  </div>
)}
```

**保存反馈**:
- 成功: "系统配置已更新并同步到 Edge Functions，立即生效"
- 回退: "系统配置已保存到数据库，Edge Functions 将从数据库读取配置"

### 5. Edge Function 更新

#### sync-config-to-secrets

**功能**: 将数据库配置同步到 Edge Function 环境变量

**更新内容**:
- 尝试调用 Supabase Management API 同步密钥
- 如果 API 调用失败，仍然返回成功（因为数据库已更新）
- 返回同步状态，让前端知道是否成功同步到环境变量

**代码逻辑**:
```typescript
// 调用 Supabase Management API 批量创建/更新密钥
const response = await fetch(
  `https://api.supabase.com/v1/projects/${projectRef}/secrets`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(secretsToSync),
  }
);
```

### 6. 使用示例

#### 在 Edge Function 中使用 SerpAPI

使用统一的 `serpapi-search` 函数：

**单引擎搜索**:
```typescript
const { data, error } = await supabase.functions.invoke('serpapi-search', {
  body: {
    single: {
      engine: 'scholar',  // 'scholar' | 'news' | 'search'
      query: { q: 'AI Agent 商业化', num: 10 }
    }
  }
});
```

**多引擎并行搜索**:
```typescript
const { data, error } = await supabase.functions.invoke('serpapi-search', {
  body: {
    queries: {
      scholar: [{ q: 'AI Agent commercialization', num: 10, as_ylo: 2020 }],
      news: [{ q: 'AI Agent 商业化 新闻', hl: 'zh-CN' }],
      search: [{ q: 'AI Agent business model', num: 10 }]
    }
  }
});

// 返回结果按引擎类型分组
// data.scholar - Scholar 搜索结果数组
// data.news - News 搜索结果数组
// data.search - Web 搜索结果数组
```

**优势**:
- 1 次 HTTP 请求替代 3 次
- 内部 Promise.all 并行执行
- 减少冷启动开销

### 7. 测试验证

#### 验证配置是否生效

1. **检查数据库配置**:
```sql
SELECT config_key, config_value, updated_at 
FROM system_config 
WHERE config_key = 'search_api_key';
```

2. **检查 Edge Function 环境变量**:
- 在 Supabase Dashboard → Edge Functions → Secrets
- 查看 `SERPAPI_API_KEY` 是否存在

3. **测试搜索功能**:
- 在项目中进行资料搜索
- 查看是否能正常返回 Google Scholar、Google Search、Google News 的结果

#### 预期结果

✅ **成功标志**:
- 管理面板显示 "✓ 已配置"
- 搜索功能正常工作
- Edge Function 日志显示成功调用 SerpAPI

❌ **失败标志**:
- 管理面板显示 "未配置"
- 搜索返回 "SerpAPI 未配置" 错误
- Edge Function 日志显示 API Key 缺失

### 8. 故障排查

#### 问题: 管理面板保存后仍显示未配置

**解决方案**:
1. 刷新页面重新加载配置
2. 检查浏览器控制台是否有错误
3. 检查数据库 system_config 表是否有记录

#### 问题: 搜索功能返回 "SerpAPI 未配置"

**解决方案**:
1. 检查数据库配置: `SELECT * FROM system_config WHERE config_key = 'search_api_key'`
2. 检查 Edge Function Secrets 是否有 `SERPAPI_API_KEY`
3. 重新在管理面板保存配置
4. 等待 1-2 分钟让配置生效

#### 问题: SerpAPI 返回 401 Unauthorized

**解决方案**:
1. 验证 API Key 是否正确
2. 检查 SerpAPI 账户是否有足够的配额
3. 访问 https://serpapi.com/manage-api-key 查看 API Key 状态

### 9. 相关文件

#### 前端
- `src/pages/AdminPage.tsx` - 管理面板配置界面

#### Edge Functions
- `supabase/functions/sync-config-to-secrets/index.ts` - 配置同步
- `supabase/functions/serpapi-search/index.ts` - 统一搜索入口（支持 Scholar/News/Search）
- `supabase/functions/research-retrieval-agent/index.ts` - 资料检索 Agent（调用 serpapi-search）

#### 数据库
- `system_config` 表 - 存储配置
  - `search_api_key`: SerpAPI Key
  - `search_provider`: 搜索提供商（serpapi）

### 10. 安全注意事项

1. **API Key 保护**:
   - ✅ 在管理面板使用 `type="password"` 隐藏输入
   - ✅ 只显示部分 API Key（前20位...后10位）
   - ✅ 仅管理员可以查看和修改配置

2. **权限控制**:
   - ✅ sync-config-to-secrets 验证管理员权限
   - ✅ 数据库 RLS 策略保护 system_config 表

3. **日志安全**:
   - ✅ Edge Function 日志不输出完整 API Key
   - ✅ 只记录 "从数据库加载了 API Key" 等提示信息

### 11. 后续优化建议

1. **配额监控**:
   - 添加 SerpAPI 使用量统计
   - 显示剩余配额
   - 配额不足时发送告警

2. **多 API Key 支持**:
   - 支持配置多个 SerpAPI Key
   - 自动轮换使用，避免单个 Key 超限

3. **缓存机制**:
   - 缓存搜索结果，减少 API 调用
   - 设置合理的缓存过期时间

4. **测试工具**:
   - 在管理面板添加 "测试连接" 按钮
   - 一键验证 API Key 是否有效

## 总结

✅ SerpAPI 已成功配置并集成到系统中
✅ 管理面板可以正常保存和显示配置
✅ 双层配置机制确保高可用性
✅ 统一的 `serpapi-search` 函数支持单引擎和多引擎并行搜索
✅ 减少了 HTTP 请求次数和冷启动开销
