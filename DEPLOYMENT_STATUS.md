# Edge Functions 部署状态

## 部署时间
2026-02-07

## 已部署的 Edge Functions

以下所有 Edge Functions 已成功部署到远程 Supabase：

### 核心搜索功能
1. ✅ **research-retrieval-agent** - 资料检索 Agent
2. ✅ **research-synthesis-agent** - 资料整理 Agent
3. ✅ **google-scholar-search** - Google Scholar 学术搜索
4. ✅ **thenews-search** - TheNews 新闻搜索
5. ✅ **smart-search** - Smart Search (Bing) 网页搜索

### 文章生成功能
6. ✅ **generate-article-structure** - 生成文章结构
7. ✅ **generate-paragraph-structure** - 生成段落结构
8. ✅ **generate-paragraph-reasoning** - 生成段落推理
9. ✅ **generate-evidence** - 生成论据
10. ✅ **adjust-article-structure** - 调整文章结构
11. ✅ **verify-coherence** - 验证连贯性

### 辅助功能
12. ✅ **extract-url-content** - 提取 URL 内容
13. ✅ **parse-document** - 解析文档
14. ✅ **summarize-content** - 总结内容
15. ✅ **sync-config-to-secrets** - 同步配置到 Secrets

## 部署验证

所有 Edge Functions 已通过以下验证：
- ✅ 函数代码无语法错误
- ✅ 成功部署到 Supabase
- ✅ 函数名称与代码调用一致

## 使用说明

### 搜索功能
当用户点击"智能搜索"按钮时，系统会：
1. 调用 `research-retrieval-agent` 进行多源检索
2. 调用 `research-synthesis-agent` 整理资料
3. 在前端显示搜索日志和结果

### 错误排查
如果仍然出现 "Failed to send a request to the Edge Function" 错误，请检查：
1. **Supabase Secrets 配置**：确保以下 Secrets 已正确配置
   - `QIANWEN_API_KEY` - 通义千问 API 密钥
   - `INTEGRATIONS_API_KEY` - 集成服务 API 密钥（用于 Google Scholar、TheNews、Smart Search）
   
2. **网络连接**：确保浏览器可以访问 Supabase Edge Functions
   - Edge Functions URL: `https://iupvpwpfhoonpzmosdgo.supabase.co/functions/v1/`
   
3. **浏览器控制台**：查看详细的错误日志
   - 打开浏览器开发者工具 (F12)
   - 查看 Console 标签页
   - 查看 Network 标签页，筛选 "functions" 请求

4. **Edge Function 日志**：在 Supabase Dashboard 中查看 Edge Function 日志
   - 访问 Supabase Dashboard
   - 进入 Edge Functions 页面
   - 查看各个函数的日志输出

## 下一步操作

如果搜索功能仍然失败，请：
1. 刷新浏览器页面 (Ctrl+F5 或 Cmd+Shift+R)
2. 清除浏览器缓存
3. 检查 Supabase Dashboard 中的 Edge Function 状态
4. 查看浏览器控制台中的详细错误信息
5. 检查 Supabase Secrets 配置是否正确
