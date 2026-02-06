# 快速调试参考卡

## 🔍 如何查看详细错误信息

### 步骤 1: 打开控制台
- **Windows/Linux**: 按 `F12` 或 `Ctrl + Shift + I`
- **Mac**: 按 `Cmd + Option + I`
- 或右键点击页面 → 选择"检查"

### 步骤 2: 切换到 Console 标签
在开发者工具顶部找到并点击 "Console" 标签

### 步骤 3: 执行搜索
在应用中进行搜索操作，观察控制台输出

### 步骤 4: 查找错误信息
搜索失败时，控制台会显示类似以下内容：

```
搜索失败 - 完整错误对象: {...}
错误类型: object
错误属性: ["message", "context"]
错误消息: API密钥未配置
发现 error.context
context 文本: {"error": "API密钥未配置"}
解析后的错误: API密钥未配置
```

---

## 🚨 常见错误速查表

| 错误信息 | 原因 | 解决方案 |
|---------|------|---------|
| API密钥未配置 | INTEGRATIONS_API_KEY 未设置 | 在 Supabase Dashboard → Settings → Secrets 中添加密钥 |
| LLM API 请求失败: 401 | API 密钥无效 | 检查并更新 INTEGRATIONS_API_KEY |
| LLM API 请求失败: 403 | 权限不足或配额用完 | 检查 API 配额和权限 |
| 解析整理结果失败 | LLM 返回格式错误 | 查看 Edge Function 日志，可能需要调整 prompt |
| 缺少检索结果或需求文档 | 数据传递问题 | 确保已创建需求文档 |
| Edge Function returned a non-2xx status code | 通用错误 | 查看控制台详细日志 |

---

## 📊 搜索进度阶段说明

搜索过程分为以下阶段，失败时会显示具体在哪个阶段：

1. **准备中** - 初始化搜索环境
2. **读取需求** - 读取项目需求文档
3. **资料查询** - 从 5 个数据源检索
   - Google Scholar（学术论文）
   - TheNews（新闻资讯）
   - Smart Search（智能网页搜索）
   - 参考文章库（用户上传的文章）
   - 个人素材库（个人知识库）
4. **资料整理** - 使用 AI 整理和中文化资料
5. **保存资料** - 保存到项目知识库
6. **完成** - 搜索成功

---

## 🛠️ 快速测试命令

### 测试 1: 检查 API 密钥是否存在
在浏览器控制台执行：
```javascript
const { data, error } = await supabase.functions.invoke('research-synthesis-agent', {
  body: { 
    retrievalResults: { test: 'data' }, 
    requirementsDoc: { 主题: '测试' } 
  }
});
console.log('返回数据:', data);
console.log('错误信息:', error);
```

### 测试 2: 手动触发搜索并查看日志
1. 在搜索框输入任意内容
2. 点击"智能搜索"
3. 立即切换到控制台查看实时日志

---

## 📝 报告问题时需要提供的信息

如果问题无法自行解决，请提供以下信息：

1. **控制台日志截图** - 包含完整的错误输出
2. **失败阶段** - 在哪个阶段失败（准备中/读取需求/资料查询/资料整理/保存资料）
3. **错误消息** - 显示的具体错误文本
4. **操作步骤** - 如何重现问题
5. **网络请求** - 开发者工具 → Network 标签中的相关请求

---

## 🔗 相关文档

- **详细调试指南**: 查看 `DEBUG_GUIDE.md`
- **修复说明**: 查看 `FIX_DOCUMENTATION.md`
- **Edge Function 日志**: Supabase Dashboard → Edge Functions → Logs

---

## 💡 提示

- 搜索失败后，进度信息会在 3 秒后自动消失
- 如果看到 API 密钥相关错误，系统会自动显示配置提示
- 所有错误都会在控制台记录详细信息，即使界面上只显示简要提示
- 建议在搜索前打开控制台，以便实时查看日志
