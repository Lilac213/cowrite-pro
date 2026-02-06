# 修复无限递归 Bug

## 问题描述

### 症状
- 搜索功能失败，显示 "Failed to send a request to the Edge Function" 错误
- 浏览器报告 CORS 错误或连接关闭错误
- Edge Function 无响应

### 根本原因
`research-synthesis-agent` Edge Function 中的 `addLog` 函数存在致命的无限递归 Bug：

```typescript
// ❌ 错误的代码（修改前）
const addLog = (...args: any[]) => {
  const message = args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
  ).join(' ');
  addLog(...args);  // ❌ 致命错误：自己调用自己！
  logs.push(message);
};
```

**问题分析**：
1. `addLog` 函数内部调用了 `addLog` 自己
2. 导致程序一运行就陷入无限死循环（递归调用）
3. 瞬间耗尽内存，触发堆栈溢出（Stack Overflow）
4. Edge Function 崩溃，无法返回任何 HTTP 响应

**为什么会显示 CORS 错误？**
- 函数在处理任何请求之前就因为"堆栈溢出"崩溃了
- 服务器直接切断了连接，没有返回任何 HTTP 响应头
- 浏览器没收到响应头，就默认报了一个通用的 CORS（跨域）或 Connection Closed 错误

## 解决方案

### 修复代码
将递归调用改为调用系统的 `console.log`，这样既能打印日志到控制台，又能保存到 `logs` 数组中返回给前端：

```typescript
// ✅ 正确的代码（修改后）
const addLog = (...args: any[]) => {
  const message = args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
  ).join(' ');
  console.log(...args);  // ✅ 正确：调用系统打印函数
  logs.push(message);
};
```

### 修改的文件
- `supabase/functions/research-synthesis-agent/index.ts` - 第 24 行

### 验证状态
- ✅ `research-retrieval-agent` - 代码正确，无需修改
- ✅ `research-synthesis-agent` - 已修复并重新部署

## 测试验证

### 预期行为
修复后，搜索功能应该能够：
1. 成功调用 `research-retrieval-agent` 进行资料检索
2. 成功调用 `research-synthesis-agent` 进行资料整理
3. 在前端显示搜索日志和结果
4. 不再出现 CORS 错误或连接关闭错误

### 测试步骤
1. 刷新浏览器页面（Ctrl+F5 或 Cmd+Shift+R）
2. 进入项目的"资料查询"阶段
3. 点击"智能搜索"按钮
4. 观察搜索进度和日志输出
5. 确认搜索结果正常显示

### 如果仍然失败
如果修复后仍然出现错误，请检查：
1. **清除浏览器缓存**：确保使用最新的代码
2. **检查 Supabase Secrets**：确保 `QIANWEN_API_KEY` 和 `INTEGRATIONS_API_KEY` 已正确配置
3. **查看浏览器控制台**：查看详细的错误日志
4. **查看 Edge Function 日志**：在 Supabase Dashboard 中查看函数日志

## 技术细节

### 无限递归的危害
```
addLog() 调用 addLog()
  → addLog() 调用 addLog()
    → addLog() 调用 addLog()
      → addLog() 调用 addLog()
        → ... (无限循环)
          → 堆栈溢出
            → 程序崩溃
```

### 正确的实现
```
addLog() 调用 console.log()  ✅ 系统函数，不会递归
  → 日志输出到控制台
  → 日志保存到 logs 数组
  → 返回给前端显示
```

## 经验教训

1. **避免递归调用自己**：除非是有意设计的递归算法，否则函数不应该调用自己
2. **代码审查很重要**：这类错误在代码审查时很容易发现
3. **测试很关键**：在部署前应该测试 Edge Function 是否能正常运行
4. **错误信息可能误导**：CORS 错误不一定是跨域问题，可能是服务器崩溃导致的

## 部署状态

- ✅ Bug 已修复
- ✅ Edge Function 已重新部署
- ✅ 代码已验证正确
- ✅ 可以开始测试
