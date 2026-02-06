# 🔍 搜索调试功能部署总结

## ✅ 已完成的工作

### 1. Edge Function 增强日志

**文件**: `/supabase/functions/research-retrieval-agent/index.ts`

**新增日志内容**:

- ✅ API Keys 状态检查（存在性、长度、前缀）
- ✅ Google Scholar 搜索详细日志
  - 查询关键词
  - 请求 URL
  - 响应状态码
  - 原始响应内容（前 500 字符）
  - 数据结构分析
  - 结果数量统计
  - 第一条结果示例
- ✅ TheNews 搜索详细日志
- ✅ Smart Search 搜索详细日志
- ✅ 搜索任务统计
- ✅ 去重前后对比
- ✅ 最终结果统计和示例

**部署状态**: ✅ 已部署

### 2. 搜索调试页面

**文件**: `/src/pages/SearchDebugPage.tsx`
**路由**: `/search-debug`

**功能特性**:

- ✅ 可自定义需求文档进行测试
- ✅ 实时显示执行日志
- ✅ 显示搜索结果统计
- ✅ 分类显示各数据源结果
  - 📚 学术来源（Google Scholar）
  - 📰 新闻来源（TheNews）
  - 🌐 网络来源（Smart Search）
- ✅ 显示搜索摘要（理解的主题、关键维度）
- ✅ 显示完整的原始响应数据（JSON 格式）
- ✅ 错误信息高亮显示
- ✅ 调试提示和指导

**部署状态**: ✅ 已添加到路由

### 3. 调试文档

**文件**: `/SEARCH_DEBUG_GUIDE.md`

**内容包括**:

- 🔧 调试工具使用说明
- 📋 诊断步骤（4 个主要步骤）
- 🐛 常见问题和解决方案
- ✅ 调试检查清单
- 🔧 高级调试技巧
- 📝 问题报告指南

## 🚀 如何使用

### 快速开始

1. **访问调试页面**
   ```
   URL: /search-debug
   ```

2. **执行测试搜索**
   - 查看默认的需求文档
   - 点击"开始搜索"按钮
   - 观察执行日志

3. **查看结果**
   - 执行日志：实时显示搜索流程
   - 搜索结果：分类显示各数据源的结果
   - 原始数据：完整的 JSON 响应

4. **查看 Edge Function 日志**
   - 登录 Supabase Dashboard
   - Edge Functions → research-retrieval-agent → Logs
   - 查看详细的后端日志

## 🔍 日志示例

### 前端日志（调试页面）

```
[14:30:15] 🚀 开始搜索流程
[14:30:15] ✅ 需求文档解析成功
[14:30:15] 📋 主题: AI Agent应用的商业化路径与目标用户定位方法论
[14:30:15] 👤 用户 ID: abc123...
[14:30:15] 📡 调用 research-retrieval-agent Edge Function...
[14:30:18] ⏱️ 请求耗时: 3245ms
[14:30:18] ✅ Edge Function 调用成功
[14:30:18] 📊 搜索结果统计:
[14:30:18]    - 学术来源: 8 条
[14:30:18]    - 新闻来源: 5 条
[14:30:18]    - 网络来源: 7 条
[14:30:18]    - 用户库来源: 0 条
[14:30:18]    - 总计: 20 条
[14:30:18] 🎯 搜索主题: AI Agent应用的商业化路径
[14:30:18] 📌 关键维度: 商业化策略, 用户定位, 市场分析
[14:30:18] ✅ 搜索流程完成
```

### 后端日志（Edge Function）

```
========== API Keys 状态检查 ==========
QIANWEN_API_KEY 存在: true
QIANWEN_API_KEY 长度: 40
QIANWEN_API_KEY 前缀: sk-b502cf1
INTEGRATIONS_API_KEY 存在: true
INTEGRATIONS_API_KEY 长度: 32
INTEGRATIONS_API_KEY 前缀: int_abc123

========== Google Scholar 搜索开始 ==========
学术查询关键词: ["AI Agent commercialization", "target user positioning"]
[Google Scholar] 查询: "AI Agent commercialization"
[Google Scholar] URL: https://app-9bwpferlujnl-api-Xa6JZq2055oa.gateway.appmedo.com/search?engine=google_scholar&q=AI%20Agent%20commercialization&as_ylo=2020&hl=en
[Google Scholar] 响应状态: 200
[Google Scholar] 原始响应: {"organic_results":[{"title":"Commercialization of AI Agents"...
[Google Scholar] 解析后的数据结构: ["organic_results", "search_metadata"]
[Google Scholar] organic_results 存在: true
[Google Scholar] organic_results 长度: 10
[Google Scholar] 第一条结果示例: {"title":"Commercialization of AI Agents","authors":"Smith et al.","snippet":"..."}
[Google Scholar] 映射后的结果数量: 5

========== 等待所有搜索完成 ==========
搜索任务数量: 6
学术来源数量: 10
新闻来源数量: 8
网络来源数量: 9
用户库来源数量: 0

========== 开始去重 ==========
去重前数量: {academic: 10, news: 8, web: 9}
去重后数量: {academic: 8, news: 5, web: 7}

========== 最终结果统计 ==========
总计资料数量: 20
```

## 🐛 常见问题诊断

### 问题 1: 搜索结果为空

**检查步骤**:

1. ✅ 访问 `/search-debug`
2. ✅ 点击"开始搜索"
3. ✅ 查看执行日志中的错误信息
4. ✅ 查看 Edge Function 日志中的详细信息

**可能原因**:

- ❌ INTEGRATIONS_API_KEY 未配置
  - 解决：联系平台管理员配置
- ❌ INTEGRATIONS_API_KEY 无效
  - 解决：检查密钥是否正确
- ❌ API 响应格式变化
  - 解决：查看原始响应，更新字段映射
- ❌ 搜索关键词不合适
  - 解决：修改需求文档，调整关键词

### 问题 2: 只有部分数据源有结果

**检查步骤**:

1. ✅ 查看 Edge Function 日志
2. ✅ 找到失败的数据源
3. ✅ 查看该数据源的响应状态码和错误信息

**可能原因**:

- ⚠️ 某个 API 暂时不可用
- ⚠️ 查询词不匹配该数据源
- ⚠️ API 配额限制

### 问题 3: 搜索计划生成失败

**检查步骤**:

1. ✅ 查看 Edge Function 日志中的 "通义千问返回内容"
2. ✅ 确认是否包含 ---JSON--- 标记
3. ✅ 确认 JSON 格式是否正确

**可能原因**:

- ❌ QIANWEN_API_KEY 无效
- ❌ 通义千问 API 配额用完
- ❌ 返回格式不符合预期

## 📊 调试检查清单

使用此清单系统地排查问题：

### API Keys 配置
- [ ] QIANWEN_API_KEY 已配置
- [ ] INTEGRATIONS_API_KEY 已配置
- [ ] 两个 Key 都有正确的长度和格式

### 搜索计划生成
- [ ] 通义千问 API 调用成功
- [ ] 返回内容包含 ---JSON--- 标记
- [ ] JSON 解析成功
- [ ] academic_queries 有值
- [ ] news_queries 有值
- [ ] web_queries 有值

### 数据源搜索
- [ ] Google Scholar 搜索成功（响应 200，有结果）
- [ ] TheNews 搜索成功（响应 200，有结果）
- [ ] Smart Search 搜索成功（响应 200，有结果）

### 最终结果
- [ ] 去重成功
- [ ] 总计结果数量 > 0
- [ ] 前端正确显示结果

## 🎯 下一步行动

1. **立即测试**
   - 访问 `/search-debug`
   - 执行一次测试搜索
   - 查看日志和结果

2. **如果有问题**
   - 查看 Edge Function 日志
   - 根据检查清单排查
   - 收集日志信息

3. **报告问题**
   - 提供调试页面截图
   - 提供 Edge Function 日志
   - 说明具体的错误信息

## 📚 相关文档

- [搜索调试指南](./SEARCH_DEBUG_GUIDE.md) - 详细的调试步骤和问题解决
- [配置管理指南](./CONFIG_MANAGEMENT_GUIDE.md) - API Keys 配置说明
- [快速配置指南](./QUICK_START_CONFIG.md) - 快速开始配置

---

**部署时间**: 2025-02-06
**状态**: ✅ 已完成
**调试页面**: `/search-debug`
**优先级**: 🔴 高（用于诊断搜索问题）
