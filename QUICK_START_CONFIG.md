# 🚀 快速开始：配置 LLM 和搜索服务

## 📋 配置清单

### ✅ 已完成（自动）
- [x] QIANWEN_API_KEY 已从管理面板同步到 Edge Functions
- [x] 值：`sk-b502cf1a41924290a2b7405e095f7587`
- [x] 来源：管理面板 → 系统配置 → LLM 配置

### ⚠️ 需要配置（手动）
- [ ] INTEGRATIONS_API_KEY 需要平台管理员配置
- [ ] 用途：访问 Google Scholar、TheNews、OpenAlex 等搜索 API

## 🎯 当前状态

### 管理面板配置
```
✅ LLM 提供商：通义千问 (Qwen)
✅ LLM API 密钥：sk-b502cf1a41924290a2b7405e095f7587
✅ 搜索提供商：OpenAlex
⚠️ 搜索 API 密钥：未配置（使用平台级密钥）
```

### Edge Function Secrets
```
✅ QIANWEN_API_KEY = sk-b502cf1a41924290a2b7405e095f7587
   └─ 用途：调用通义千问 API
   └─ 状态：已配置
   └─ 来源：从管理面板自动同步

⚠️ INTEGRATIONS_API_KEY = (需要配置)
   └─ 用途：访问搜索 API Gateway
   └─ 状态：未配置
   └─ 来源：需要平台管理员手动配置
```

## 🔧 如何配置 INTEGRATIONS_API_KEY

### 方式 1：联系平台管理员（推荐）

1. **发送配置请求**
   ```
   项目 ID: app-9bwpferlujnl
   需要配置: INTEGRATIONS_API_KEY
   用途: 访问 Google Scholar、TheNews、OpenAlex 搜索 API
   ```

2. **等待配置完成**
   - 平台管理员会在 Supabase Dashboard 中配置
   - 配置完成后会通知您

3. **验证配置**
   - 访问学术资料查询页面
   - 测试搜索功能
   - 确认不再出现 "INTEGRATIONS_API_KEY 未配置" 错误

### 方式 2：自行配置（如果您是平台管理员）

1. **登录 Supabase Dashboard**
   - 访问：https://supabase.com/dashboard
   - 选择项目：`app-9bwpferlujnl`

2. **进入环境变量设置**
   ```
   Settings → Edge Functions → Environment Variables
   ```

3. **添加环境变量**
   ```
   Name: INTEGRATIONS_API_KEY
   Value: [您的 API Gateway 密钥]
   ```

4. **保存并验证**
   - 点击 Save
   - 等待几分钟生效
   - 测试搜索功能

## 🧪 测试配置

### 测试 QIANWEN_API_KEY（应该已经可用）

1. **访问学术资料查询页面**
   - URL: `/research` 或从导航菜单进入

2. **输入测试查询**
   ```
   AI Agent应用的商业化路径与目标用户定位方法论
   ```

3. **点击"智能搜索"**

4. **预期结果**
   - ✅ 不再出现 "QIANWEN_API_KEY 未配置" 错误
   - ✅ 显示"正在生成搜索计划..."
   - ⚠️ 可能出现 "INTEGRATIONS_API_KEY 未配置" 错误（正常，需要配置）

### 测试 INTEGRATIONS_API_KEY（配置后）

1. **配置完成后，重新测试搜索**

2. **预期结果**
   - ✅ 搜索计划生成成功
   - ✅ Google Scholar 搜索成功
   - ✅ TheNews 搜索成功
   - ✅ OpenAlex 搜索成功
   - ✅ 返回完整的搜索结果

## 📊 配置状态检查

### 在管理面板查看

1. **访问管理面板**
   ```
   URL: /admin
   ```

2. **切换到"系统配置"标签**

3. **查看配置状态**
   ```
   LLM 配置
   ├─ 状态徽章: ✅ 已配置
   ├─ LLM 提供商: 通义千问 (Qwen)
   └─ API 密钥: ••••••••••••••••••••••••••••••••

   同步状态提示
   ├─ 🔄 Edge Function 同步
   ├─ 保存配置后，API 密钥将自动同步到 Edge Functions（QIANWEN_API_KEY）
   └─ ⚠️ INTEGRATIONS_API_KEY（搜索服务密钥）需要平台管理员单独配置
   ```

### 在浏览器控制台查看

1. **打开开发者工具**
   ```
   按 F12 或右键 → 检查
   ```

2. **切换到 Console 标签**

3. **查看日志**
   ```javascript
   // 搜索时会显示：
   开始调用通义千问 API 生成搜索计划...
   通义千问返回内容: ...
   
   // 如果 INTEGRATIONS_API_KEY 未配置：
   错误: INTEGRATIONS_API_KEY 未配置
   ```

## 🎨 管理面板截图说明

### LLM 配置卡片

```
┌─────────────────────────────────────────────────────┐
│ LLM 配置                              ✅ 已配置      │
│ 配置全局 LLM 服务（通义千问）                         │
├─────────────────────────────────────────────────────┤
│                                                     │
│ LLM 提供商                                          │
│ ┌─────────────────────────────────────────────┐   │
│ │ 通义千问 (Qwen)                              │   │
│ └─────────────────────────────────────────────┘   │
│ 系统默认使用通义千问作为 LLM 提供商                  │
│                                                     │
│ API 密钥                                            │
│ ┌─────────────────────────────────────────────┐   │
│ │ ••••••••••••••••••••••••••••••••            │   │
│ └─────────────────────────────────────────────┘   │
│ 在阿里云控制台获取：https://dashscope.console...    │
│                                                     │
│ ┌───────────────────────────────────────────────┐ │
│ │ 🔄 Edge Function 同步                          │ │
│ │                                                │ │
│ │ 保存配置后，API 密钥将自动同步到 Edge Functions │ │
│ │ （QIANWEN_API_KEY）                            │ │
│ │                                                │ │
│ │ ⚠️ INTEGRATIONS_API_KEY（搜索服务密钥）需要平台│ │
│ │ 管理员单独配置                                  │ │
│ └───────────────────────────────────────────────┘ │
│                                                     │
│                              [保存配置]             │
└─────────────────────────────────────────────────────┘
```

## 🔄 配置更新流程

### 更新 LLM API Key

1. **在管理面板修改**
   - 访问 `/admin`
   - 切换到"系统配置"
   - 修改 API 密钥
   - 点击"保存配置"

2. **自动同步**
   - 系统自动更新数据库
   - 系统自动调用 sync-config-to-secrets
   - 系统自动更新 Edge Function Secrets

3. **验证更新**
   - 查看成功提示："系统配置已更新并同步到 Edge Functions"
   - 测试搜索功能

### 更新 INTEGRATIONS_API_KEY

⚠️ **此密钥需要在 Supabase Dashboard 中手动更新**

1. **登录 Supabase Dashboard**
2. **进入环境变量设置**
3. **更新 INTEGRATIONS_API_KEY 的值**
4. **保存**
5. **等待几分钟生效**
6. **测试搜索功能**

## 📞 需要帮助？

### 常见问题

**Q1: 为什么 QIANWEN_API_KEY 可以在管理面板配置，但 INTEGRATIONS_API_KEY 不行？**

A: 
- QIANWEN_API_KEY 是用户级配置，每个用户可以使用自己的通义千问账号
- INTEGRATIONS_API_KEY 是平台级配置，用于访问统一的 API Gateway，需要平台统一管理

**Q2: 我修改了 LLM API Key，但搜索还是失败？**

A:
- 检查新的 API Key 是否有效
- 检查阿里云账户余额
- 查看浏览器控制台的错误信息
- 查看 Edge Function 日志

**Q3: 如何查看 Edge Function 日志？**

A:
1. 登录 Supabase Dashboard
2. 进入 Edge Functions
3. 选择对应的函数（research-retrieval-agent 或 research-synthesis-agent）
4. 点击 Logs 标签
5. 查看最近的日志

**Q4: INTEGRATIONS_API_KEY 配置后多久生效？**

A:
- 通常在 1-5 分钟内生效
- 如果超过 5 分钟仍未生效，尝试刷新页面
- 如果仍然不行，检查配置是否正确

### 联系支持

如果遇到问题：

1. **查看文档**
   - [配置管理指南](./CONFIG_MANAGEMENT_GUIDE.md)
   - [故障排查指南](./TROUBLESHOOTING_GUIDE.md)

2. **检查日志**
   - 浏览器控制台日志
   - Edge Function 日志

3. **联系管理员**
   - 提供详细的错误信息
   - 提供操作步骤
   - 提供截图（如果可能）

## 🎉 配置完成后

### 可用功能

- ✅ 学术资料查询
  - 输入研究需求
  - AI 自动生成搜索计划
  - 多源搜索（Google Scholar、TheNews、OpenAlex）
  - AI 整理研究资料

- ✅ 智能搜索
  - 学术论文搜索
  - 新闻和行业动态搜索
  - 开放学术资源搜索

- ✅ 资料整理
  - 中文化翻译
  - 信息提炼
  - 结构化输出

### 下一步

1. **测试所有功能**
   - 尝试不同的研究主题
   - 验证搜索结果质量
   - 检查资料整理效果

2. **监控使用情况**
   - 定期检查 API 调用量
   - 监控账户余额
   - 查看错误日志

3. **优化配置**
   - 根据使用情况调整 API 配额
   - 优化搜索关键词
   - 改进提示词

---

**更新时间**：2025-02-06
**状态**：✅ QIANWEN_API_KEY 已配置 | ⚠️ INTEGRATIONS_API_KEY 待配置
**优先级**：🔴 高（需要配置 INTEGRATIONS_API_KEY 才能完整使用搜索功能）
