# 配置 Supabase Secrets

## 问题诊断

当前错误："Failed to send a request to the Edge Function" 和 "ERR_CONNECTION_CLOSED"

这个错误通常是因为：
1. **Edge Function 缺少必需的 API 密钥配置**
2. Edge Function 在启动时崩溃
3. 网络连接问题

## 必需的 Secrets 配置

CoWrite 应用需要以下两个 Secrets 才能正常工作：

### 1. QIANWEN_API_KEY
- **用途**: 调用通义千问 API 进行搜索计划生成和资料整理
- **获取方式**: 
  1. 访问阿里云通义千问控制台
  2. 创建 API 密钥
  3. 复制密钥值

### 2. INTEGRATIONS_API_KEY
- **用途**: 调用集成服务 API 进行多源搜索
  - Google Scholar 学术搜索
  - TheNews 新闻搜索
  - Smart Search (Bing) 网页搜索
- **获取方式**: 
  1. 访问集成服务控制台
  2. 创建 API 密钥
  3. 复制密钥值

## 配置步骤

### 方法 1: 通过 Supabase Dashboard 配置（推荐）

1. **登录 Supabase Dashboard**
   - 访问: https://supabase.com/dashboard
   - 选择项目: `app-9bwpferlujnl`

2. **进入 Edge Functions 设置**
   - 点击左侧菜单 "Edge Functions"
   - 点击 "Manage secrets" 或 "Settings"

3. **添加 Secrets**
   - 点击 "Add secret" 按钮
   - 添加第一个 Secret:
     - Name: `QIANWEN_API_KEY`
     - Value: `[你的通义千问 API 密钥]`
   - 添加第二个 Secret:
     - Name: `INTEGRATIONS_API_KEY`
     - Value: `[你的集成服务 API 密钥]`

4. **保存并重启 Edge Functions**
   - 点击 "Save" 保存配置
   - Edge Functions 会自动重启并加载新的 Secrets

### 方法 2: 通过应用内管理面板配置

1. **访问管理面板**
   - 登录 CoWrite 应用
   - 访问管理面板页面（需要管理员权限）

2. **配置 LLM 服务**
   - 在 "LLM 配置" 部分
   - 输入通义千问 API 密钥
   - 点击保存

3. **配置搜索服务**
   - 在 "搜索配置" 部分
   - 输入集成服务 API 密钥
   - 点击保存

4. **系统自动同步**
   - 应用会自动调用 `sync-config-to-secrets` Edge Function
   - 将配置同步到 Supabase Secrets

## 验证配置

### 1. 检查 Secrets 是否已配置

在 Supabase Dashboard 中：
1. 进入 Edge Functions → Settings
2. 查看 Secrets 列表
3. 确认 `QIANWEN_API_KEY` 和 `INTEGRATIONS_API_KEY` 已存在

### 2. 测试 Edge Function

1. 刷新浏览器页面（Ctrl+F5 或 Cmd+Shift+R）
2. 进入项目的"资料查询"阶段
3. 点击"智能搜索"按钮
4. 观察是否能成功搜索

### 3. 查看 Edge Function 日志

在 Supabase Dashboard 中：
1. 进入 Edge Functions
2. 选择 `research-retrieval-agent` 函数
3. 查看 Logs 标签页
4. 确认函数能正常启动和运行

## 常见问题

### Q1: 配置了 Secrets 但仍然报错
**解决方案**:
1. 确认 Secrets 名称完全正确（区分大小写）
2. 确认 API 密钥值正确无误（没有多余的空格）
3. 重新部署 Edge Functions
4. 清除浏览器缓存并刷新页面

### Q2: 如何知道 Secrets 是否生效？
**解决方案**:
1. 查看 Edge Function 日志
2. 日志中会显示 "QIANWEN_API_KEY 存在: true"
3. 如果显示 "false"，说明 Secrets 未配置或未生效

### Q3: 可以使用测试 API 密钥吗？
**解决方案**:
- 可以，但测试密钥通常有调用次数限制
- 建议使用正式的 API 密钥以确保稳定性

### Q4: 如何更新 Secrets？
**解决方案**:
1. 在 Supabase Dashboard 中删除旧的 Secret
2. 添加新的 Secret（使用相同的名称）
3. Edge Functions 会自动重启并加载新值

## 安全建议

1. **不要在代码中硬编码 API 密钥**
   - ❌ 错误: `const apiKey = 'sk-xxx'`
   - ✅ 正确: `const apiKey = Deno.env.get('QIANWEN_API_KEY')`

2. **不要将 API 密钥提交到 Git**
   - 确保 `.env` 文件在 `.gitignore` 中
   - 使用 Supabase Secrets 管理敏感信息

3. **定期轮换 API 密钥**
   - 建议每 3-6 个月更换一次 API 密钥
   - 如果怀疑密钥泄露，立即更换

4. **限制 API 密钥权限**
   - 只授予必要的权限
   - 设置 IP 白名单（如果服务支持）

## 下一步

配置完 Secrets 后：
1. ✅ 刷新浏览器页面
2. ✅ 重新尝试搜索功能
3. ✅ 查看浏览器控制台，确认没有错误
4. ✅ 查看 Edge Function 日志，确认正常运行

如果仍然有问题，请检查：
- 网络连接是否正常
- Supabase 项目状态是否正常
- API 密钥是否有效且未过期
