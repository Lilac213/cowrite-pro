# ⚡ 快速配置指南：通义千问 API

## 🎯 问题
您看到错误："DEEPSEEK_API_KEY 未配置" 或 "QIANWEN_API_KEY 未配置"

## ✅ 解决方案

### 步骤 1：获取通义千问 API Key

1. **访问阿里云控制台**
   - 网址：https://dashscope.console.aliyun.com/
   - 如果没有账号，需要先注册阿里云账号

2. **登录并进入 API-KEY 管理**
   - 登录后，点击左侧菜单的 "API-KEY 管理"
   - 或直接访问：https://dashscope.console.aliyun.com/apiKey

3. **创建 API Key**
   - 点击 "创建新的 API-KEY" 按钮
   - 系统会生成一个新的 API Key
   - **重要**：立即复制并保存这个 API Key，它只会显示一次！

4. **API Key 格式**
   - 通常以 `sk-` 开头
   - 例如：`sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

### 步骤 2：在 Supabase 中配置

1. **打开 Supabase Dashboard**
   - 访问您的 Supabase 项目
   - 网址格式：`https://supabase.com/dashboard/project/YOUR_PROJECT_ID`

2. **进入环境变量设置**
   - 点击左侧菜单的 "Settings"（设置）
   - 点击 "Edge Functions"
   - 找到 "Environment Variables"（环境变量）部分

3. **添加新的环境变量**
   - 点击 "Add variable" 或 "新增变量"
   - 填写以下信息：
     ```
     Name: QIANWEN_API_KEY
     Value: 您在步骤1中获取的 API Key
     ```
   - 点击 "Save" 或 "保存"

4. **确认配置**
   - 确保环境变量列表中显示 `QIANWEN_API_KEY`
   - 值应该被隐藏显示（例如：`sk-***...***`）

### 步骤 3：验证配置

1. **重新测试搜索**
   - 返回 CoWrite 应用
   - 输入研究需求
   - 点击 "智能搜索"

2. **预期结果**
   - ✅ 不再出现 "QIANWEN_API_KEY 未配置" 错误
   - ✅ 搜索正常执行
   - ✅ 返回搜索结果

## 🔍 故障排查

### 问题 1：仍然显示 "QIANWEN_API_KEY 未配置"

**可能原因**：
- 环境变量名称拼写错误
- 环境变量未保存
- 需要重新部署 Edge Functions

**解决方案**：
1. 检查环境变量名称是否完全一致：`QIANWEN_API_KEY`（区分大小写）
2. 确认已点击保存按钮
3. 如果刚添加环境变量，可能需要等待几分钟生效

### 问题 2：显示 "通义千问 API 请求失败: 401"

**可能原因**：
- API Key 无效
- API Key 已过期
- API Key 复制时包含了多余的空格

**解决方案**：
1. 重新复制 API Key，确保没有多余的空格
2. 在阿里云控制台检查 API Key 状态
3. 如果 API Key 已过期或无效，创建新的 API Key

### 问题 3：显示 "通义千问 API 请求失败: 429"

**可能原因**：
- 请求频率超过限制
- 账户余额不足

**解决方案**：
1. 检查阿里云账户余额
2. 查看 API 调用配额
3. 如果是免费试用，可能需要升级套餐

## 💡 提示

### 免费额度
- 通义千问提供免费试用额度
- 具体额度请查看阿里云控制台

### 计费说明
- 按 Token 数量计费
- qwen-plus 模型价格适中
- 详细价格：https://help.aliyun.com/zh/dashscope/developer-reference/tongyi-qianwen-metering-and-billing

### 安全建议
- ⚠️ 不要将 API Key 提交到代码仓库
- ⚠️ 不要在前端代码中暴露 API Key
- ✅ 只在 Supabase 环境变量中配置
- ✅ 定期更换 API Key

## 📞 需要帮助？

如果按照以上步骤仍然无法解决问题：

1. **检查 Edge Function 日志**
   - Supabase Dashboard → Edge Functions → research-retrieval-agent → Logs
   - 查看详细的错误信息

2. **查看相关文档**
   - [API 切换说明](./API_SWITCH_DEEPSEEK_TO_QIANWEN.md)
   - [故障排查指南](./TROUBLESHOOTING_GUIDE.md)

3. **联系支持**
   - 提供完整的错误信息
   - 提供 Edge Function 日志截图

---

**配置完成后，您就可以正常使用学术资料查询功能了！** 🎉
