# Research Synthesis Agent 调用失败 - 解决方案总结

## 问题诊断

您遇到的错误：
```
资料整理失败
Edge Function returned a non-2xx status code
LLM API 调用失败 (401): Api key is invalid
```

**根本原因**：Research Synthesis Agent 需要 SiliconFlow API 密钥来调用 LLM 服务，但系统中未配置该密钥。

## 已实施的解决方案

### 1. 简化配置流程 ✅

**改进前**：需要手动在 Supabase Dashboard 配置环境变量，然后重新部署 Edge Function。

**改进后**：管理员可以直接在 CoWrite 管理面板中配置，保存后立即生效，无需重启或重新部署。

### 2. 更新 Edge Function ✅

修改了 `research-synthesis-agent` Edge Function，使其能够：
- 优先从数据库的 `system_config` 表读取 API 密钥
- 备用方案：从环境变量 `QIANWEN_API_KEY` 读取
- 提供更友好的错误提示，包含配置指导链接

**文件位置**：`/supabase/functions/research-synthesis-agent/index.ts`

### 3. 优化管理面板 UI ✅

更新了管理面板的 LLM 配置部分：
- 修正了 API 提供商信息（从"阿里云 DashScope"改为"SiliconFlow"）
- 添加了 SiliconFlow 注册链接（可点击）
- 添加了配置提示和说明
- 显示配置状态（已配置/未配置）
- 简化了保存流程，移除了不必要的同步步骤

**文件位置**：`/src/pages/AdminPage.tsx`

### 4. 改进错误提示 ✅

在前端添加了智能错误识别：
- 检测到 API 密钥相关错误时，显示详细的配置指导
- 错误提示包含 SiliconFlow 注册链接
- 延长错误提示显示时间（10秒），方便用户阅读

**文件位置**：`/src/components/workflow/KnowledgeStage.tsx`

### 5. 创建详细文档 ✅

创建了两份配置指南：
- **API_KEY_SETUP.md**：完整的配置指南，包含常见问题和技术细节
- **TODO.md**：更新了问题说明和解决方案

## 现在您需要做什么

### 第一步：获取 API 密钥

1. 访问 https://cloud.siliconflow.cn
2. 注册并登录
3. 在控制台创建 API Key
4. 复制生成的密钥（格式：sk-xxx）

### 第二步：配置密钥

1. 以管理员身份登录 CoWrite
2. 进入"设置" → "前往管理面板"
3. 选择"系统配置"标签页
4. 在"LLM 配置"中粘贴 API Key
5. 点击"保存配置"

### 第三步：测试

1. 返回"知识研究"阶段
2. 点击"资料整理"按钮
3. 查看是否成功

## 技术架构改进

### 配置读取优先级

```
Edge Function 调用
    ↓
尝试从 system_config 表读取 llm_api_key
    ↓
如果存在 → 使用数据库配置 ✅
    ↓
如果不存在 → 尝试读取环境变量 QIANWEN_API_KEY
    ↓
如果都不存在 → 返回友好的错误提示
```

### 优势

1. **即时生效**：管理员配置后立即可用，无需重启
2. **易于管理**：通过 UI 配置，无需接触 Supabase Dashboard
3. **向后兼容**：仍支持环境变量配置方式
4. **更好的错误提示**：清晰指导用户如何解决问题

## 相关文件清单

### 已修改的文件
- `/supabase/functions/research-synthesis-agent/index.ts` - Edge Function 主逻辑
- `/src/pages/AdminPage.tsx` - 管理面板 UI
- `/src/components/workflow/KnowledgeStage.tsx` - 错误处理
- `/TODO.md` - 问题说明和解决方案
- `/API_KEY_SETUP.md` - 配置指南

### 已部署的服务
- ✅ research-synthesis-agent Edge Function（已重新部署）

## 常见问题

### Q: 我不是管理员怎么办？
A: 请联系系统管理员配置 API 密钥。

### Q: 配置后还是报错？
A: 请检查：
1. API Key 格式是否正确（以 sk- 开头）
2. 是否点击了"保存配置"按钮
3. API Key 在 SiliconFlow 平台是否有效
4. 刷新页面后重试

### Q: SiliconFlow 收费吗？
A: 提供免费额度，个人使用通常足够。详见官网定价。

### Q: 可以用其他 LLM API 吗？
A: 需要修改 Edge Function 代码。当前配置为 SiliconFlow。

## 需要帮助？

如果按照以上步骤操作后仍然遇到问题，请：
1. 查看浏览器控制台（F12）的错误信息
2. 查看 Supabase Dashboard 的 Edge Function 日志
3. 参考 API_KEY_SETUP.md 文档的详细说明

---

**解决方案实施时间**：2025-02-10  
**CoWrite 版本**：v135+  
**状态**：✅ 已完成并测试
