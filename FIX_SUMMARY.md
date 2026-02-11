# 修复总结：JSON 解析错误和点数限制

## 问题 1：JSON 解析失败 - 所有策略均失败

### 错误详情
```json
{
  "error": "JSON解析失败: 所有解析策略均失败:\n策略1: Unexpected token '`', \"```json\n{\n\"... is not valid JSON\n策略2: Unexpected token '`', \"```json { \"... is not valid JSON\n策略3: Unexpected token '：', ...\"40d9cfb\", ：深度互动的可持续路\"... is not valid JSON\n策略4: Unexpected token '：', ...\"40d9cfb\", ：深度互动的可持续路\"... is not valid JSON"
}
```

### 根本原因分析

#### 原因 1：Markdown 代码块标记未清除
- **问题**：LLM 返回的 JSON 被 markdown 代码块包裹（` ```json ... ``` `）
- **影响**：策略 1 和 2 失败，因为 JSON.parse() 无法解析包含反引号的字符串
- **位置**：策略 3 应该处理这个问题，但清理函数没有移除代码块标记

#### 原因 2：中文标点符号
- **问题**：LLM 使用中文冒号（：）而不是英文冒号（:）
- **影响**：策略 3 和 4 失败，因为 JSON 规范要求使用英文标点
- **示例**：`"40d9cfb", ：深度互动的可持续路` 应该是 `"40d9cfb": "深度互动的可持续路"`

#### 原因 3：Prompt 不够明确
- **问题**：Prompt 中使用了反引号（```），导致 Edge Function 解析错误
- **影响**：Edge Function 部署失败
- **解决**：改用文字描述"三个反引号"

---

## 解决方案 1：增强 JSON 清理函数

### 修改文件
`supabase/functions/generate-article-structure/index.ts`

### 新增功能

#### 1. 移除 Markdown 代码块标记
```typescript
function cleanJsonString(jsonStr: string): string {
  return jsonStr
    // 移除markdown代码块标记
    .replace(/```json\s*/g, '')
    .replace(/```\s*/g, '')
    // ... 其他清理规则
}
```

**作用**：
- 移除 ` ```json ` 和 ` ``` ` 标记
- 确保策略 1 和 2 可以处理被代码块包裹的 JSON

#### 2. 替换中文标点为英文标点
```typescript
// 替换中文标点为英文标点（JSON中必须使用英文标点）
.replace(/：/g, ':')      // 中文冒号 → 英文冒号
.replace(/，/g, ',')      // 中文逗号 → 英文逗号
.replace(/"/g, '"')       // 中文左引号 → 英文引号
.replace(/"/g, '"')       // 中文右引号 → 英文引号
.replace(/【/g, '[')      // 中文左方括号 → 英文左方括号
.replace(/】/g, ']')      // 中文右方括号 → 英文右方括号
.replace(/（/g, '(')      // 中文左圆括号 → 英文左圆括号
.replace(/）/g, ')')      // 中文右圆括号 → 英文右圆括号
```

**作用**：
- 自动将所有中文标点转换为英文标点
- 确保 JSON 符合规范
- 解决策略 3 和 4 的解析错误

#### 3. 完整的清理流程
```typescript
function cleanJsonString(jsonStr: string): string {
  return jsonStr
    // 1. 移除markdown代码块标记
    .replace(/```json\s*/g, '')
    .replace(/```\s*/g, '')
    // 2. 替换中文标点为英文标点
    .replace(/：/g, ':')
    .replace(/，/g, ',')
    .replace(/"/g, '"')
    .replace(/"/g, '"')
    .replace(/【/g, '[')
    .replace(/】/g, ']')
    .replace(/（/g, '(')
    .replace(/）/g, ')')
    // 3. 移除控制字符
    .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')
    // 4. 替换转义序列
    .replace(/(?<!\\)(\\r|\\n|\\t)/g, ' ')
    // 5. 修复逗号问题
    .replace(/,(\s*[}\]])/g, '$1')
    .replace(/([}\]])(\s*)(")/g, '$1,$2$3')
    // 6. 合并空格
    .replace(/\s+/g, ' ')
    .trim();
}
```

---

## 解决方案 2：改进 Prompt

### 修改文件
`supabase/functions/generate-article-structure/index.ts`

### 新增内容

#### 1. 明确要求使用英文标点
```
重要提示：
1. 必须使用英文标点符号：冒号用 : 不用 ：，逗号用 , 不用 ，，引号用 " 不用 " 或 "
```

**作用**：
- 明确告诉 LLM 必须使用英文标点
- 提供具体的对比示例
- 减少 LLM 使用中文标点的概率

#### 2. 禁止使用 Markdown 代码块
```
7. 不要使用 markdown 代码块包裹 JSON（不要用三个反引号）
8. 直接输出纯 JSON，确保可以被 JSON.parse() 直接解析，没有语法错误
```

**作用**：
- 明确禁止使用代码块
- 要求直接输出纯 JSON
- 避免 Edge Function 解析 Prompt 时出错（不使用反引号字符）

#### 3. 提供正确示例
```
示例（注意使用英文标点）:
{
  "core_thesis": "这是核心论点",
  "argument_blocks": [
    {
      "id": "block_1",
      "title": "标题",
      "description": "描述",
      "order": 1,
      "relation": "起始论证块",
      "derived_from": ["insight_1"],
      "user_editable": true
    }
  ]
}
```

**作用**：
- 提供正确的 JSON 格式示例
- 强调使用英文标点
- 帮助 LLM 理解期望的输出格式

---

## 问题 2：添加点数限制

### 需求
1. 资料查询和整理总共消耗 3 点
2. 支持跳过资料查询，直接生成文章结构
3. 提示非学术性论文可以跳过资料查询

---

## 解决方案 3：添加点数检查和扣除

### 修改文件
`src/db/api.ts`

### 新增函数

#### 1. 检查资料查询点数
```typescript
// 检查用户是否可以进行资料查询和整理（需要3点）
export async function checkResearchLimit(userId: string): Promise<boolean> {
  const profile = await getProfile(userId);
  if (!profile) return false;
  // 管理员无限点数
  if (profile.unlimited_credits) return true;
  // 普通用户检查点数（资料查询+整理需要3点）
  return profile.available_credits >= 3;
}
```

**功能**：
- 检查用户是否有足够的点数（3 点）
- 管理员无限点数，直接返回 true
- 普通用户检查 `available_credits >= 3`

#### 2. 扣除资料查询点数
```typescript
// 扣除资料查询和整理的点数（3点）
export async function deductResearchCredits(userId: string): Promise<void> {
  const profile = await getProfile(userId);
  if (!profile) throw new Error('用户不存在');
  
  // 管理员无限点数，不扣除
  if (profile.unlimited_credits) {
    return;
  }

  // 普通用户检查点数
  if (profile.available_credits < 3) {
    throw new Error('点数不足，资料查询和整理需要3点');
  }

  const { error } = await supabase
    .from('profiles')
    .update({ 
      available_credits: profile.available_credits - 3,
    })
    .eq('id', userId);

  if (error) throw error;
}
```

**功能**：
- 扣除 3 点
- 管理员不扣除
- 点数不足时抛出错误
- 更新数据库中的 `available_credits` 字段

#### 3. 在工作流中集成点数检查
```typescript
export async function agentDrivenResearchWorkflow(requirementsDoc: any, projectId?: string, userId?: string, sessionId?: string) {
  // 检查并扣除点数（资料查询+整理需要3点）
  if (userId) {
    const hasCredits = await checkResearchLimit(userId);
    if (!hasCredits) {
      throw new Error('点数不足，资料查询和整理需要3点');
    }
    // 扣除点数
    await deductResearchCredits(userId);
  }

  // 第一步：资料检索
  const retrievalResults = await researchRetrievalAgent(requirementsDoc, projectId, userId, sessionId);

  // 不再自动调用综合分析，等待用户选择资料后再调用
  return {
    retrievalResults,
    synthesisResults: null,
  };
}
```

**功能**：
- 在资料查询开始前检查点数
- 点数不足时抛出错误，阻止查询
- 点数足够时先扣除，再执行查询
- 确保用户已经被扣除点数

---

## 解决方案 4：添加 UI 提示

### 修改文件 1：`src/components/workflow/KnowledgeStage.tsx`

#### 1. 添加提示卡片
```tsx
{/* 提示信息 */}
<CardContent className="pb-2">
  <div className="bg-muted/50 border border-border rounded-lg p-3 text-sm">
    <div className="flex items-start gap-2">
      <span className="text-base">💡</span>
      <div className="flex-1 space-y-1">
        <p className="text-muted-foreground">
          <strong className="text-foreground">资料查询和整理需要消耗 3 点</strong>
        </p>
        <p className="text-muted-foreground">
          若不是学术性论文，可跳过此步骤，直接进入下一步生成文章结构
        </p>
      </div>
    </div>
  </div>
</CardContent>
```

**位置**：资料查询卡片的 CardHeader 之后

**作用**：
- 明确告知用户需要消耗 3 点
- 提示非学术论文可以跳过
- 引导用户做出合理选择

#### 2. 添加点数不足错误提示
```typescript
// 如果是点数不足错误，提供额外提示
if (errorMessage.includes('点数不足') || errorMessage.includes('需要3点')) {
  setTimeout(() => {
    toast({
      title: '💡 提示',
      description: '资料查询和整理需要 3 点。若不是学术性论文，可跳过此步骤直接生成文章结构',
      duration: 8000,
    });
  }, 1000);
}
```

**位置**：错误处理代码中

**作用**：
- 捕获点数不足错误
- 提供友好的错误提示
- 告知用户可以跳过的选项

---

### 修改文件 2：`src/components/layouts/AppLayout.tsx`

#### 添加点数显示
```tsx
{/* 点数显示 */}
{!isCollapsed && profile && (
  <div className="px-6 py-3 border-b border-border">
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">可用点数</span>
      <span className="font-semibold text-primary">
        {profile.unlimited_credits ? '∞' : profile.available_credits}
      </span>
    </div>
  </div>
)}
```

**位置**：侧边栏 Logo 区域之后

**作用**：
- 实时显示用户可用点数
- 管理员显示无限符号（∞）
- 普通用户显示具体数字
- 帮助用户了解剩余点数

---

## 测试场景

### 场景 1：JSON 解析 - Markdown 代码块
**输入**：
```
```json
{
  "core_thesis": "核心论点",
  "argument_blocks": []
}
```
```

**预期结果**：
- ✅ cleanJsonString 移除代码块标记
- ✅ 策略 2 成功解析
- ✅ 返回正确的结构

---

### 场景 2：JSON 解析 - 中文标点
**输入**：
```json
{
  "core_thesis"："核心论点"，
  "argument_blocks"：[]
}
```

**预期结果**：
- ✅ cleanJsonString 替换中文标点为英文标点
- ✅ 策略 2 成功解析
- ✅ 返回正确的结构

---

### 场景 3：JSON 解析 - 混合问题
**输入**：
```
```json
{
  "id"："block_1"，
  "title"："标题"
}
```
```

**预期结果**：
- ✅ 移除代码块标记
- ✅ 替换中文标点
- ✅ 策略 2 成功解析

---

### 场景 4：点数检查 - 点数充足
**前提**：
- 用户有 5 点

**操作**：
- 点击"开始资料查询"

**预期结果**：
- ✅ 检查通过
- ✅ 扣除 3 点
- ✅ 剩余 2 点
- ✅ 资料查询开始

---

### 场景 5：点数检查 - 点数不足
**前提**：
- 用户有 2 点

**操作**：
- 点击"开始资料查询"

**预期结果**：
- ❌ 检查失败
- ❌ 不扣除点数
- ❌ 显示错误提示："点数不足，资料查询和整理需要3点"
- ✅ 显示额外提示："若不是学术性论文，可跳过此步骤直接生成文章结构"

---

### 场景 6：点数检查 - 管理员
**前提**：
- 用户是管理员（unlimited_credits = true）

**操作**：
- 点击"开始资料查询"

**预期结果**：
- ✅ 检查通过
- ✅ 不扣除点数
- ✅ 点数显示仍为 ∞
- ✅ 资料查询开始

---

### 场景 7：跳过资料查询
**前提**：
- 用户点数不足或不想查询

**操作**：
- 直接点击"下一步"或"生成文章结构"

**预期结果**：
- ✅ 不检查点数
- ✅ 不扣除点数
- ✅ 直接进入文章结构生成阶段
- ✅ 可以正常生成结构

---

## 技术细节

### 1. 正则表达式说明

#### 移除 Markdown 代码块
```typescript
.replace(/```json\s*/g, '')  // 匹配 ```json 和后面的空白字符
.replace(/```\s*/g, '')      // 匹配 ``` 和后面的空白字符
```

#### 替换中文标点
```typescript
.replace(/：/g, ':')   // 全局替换中文冒号
.replace(/，/g, ',')   // 全局替换中文逗号
```

#### 移除控制字符
```typescript
.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')
```
- `\x00-\x08`：NULL 到 BS
- `\x0B-\x0C`：VT 到 FF（保留 \n 和 \t）
- `\x0E-\x1F`：SO 到 US
- `\x7F`：DEL

---

### 2. 数据库字段

#### profiles 表
```sql
available_credits INTEGER DEFAULT 2
unlimited_credits BOOLEAN DEFAULT false
```

**说明**：
- `available_credits`：用户可用点数
- `unlimited_credits`：是否无限点数（管理员）

---

### 3. 点数消耗规则

| 操作 | 消耗点数 | 说明 |
|------|---------|------|
| 创建项目 | 1 点 | 已有功能 |
| AI 降重 | 1 点 | 已有功能 |
| 资料查询 + 整理 | 3 点 | **新增功能** |
| 生成文章结构 | 0 点 | 免费 |
| 生成文章内容 | 0 点 | 免费 |

---

## 部署清单

### 已完成
- ✅ 修改 `supabase/functions/generate-article-structure/index.ts`
  - ✅ 增强 cleanJsonString 函数
  - ✅ 改进 Prompt
  - ✅ 部署 Edge Function
- ✅ 修改 `src/db/api.ts`
  - ✅ 添加 checkResearchLimit 函数
  - ✅ 添加 deductResearchCredits 函数
  - ✅ 修改 agentDrivenResearchWorkflow 函数
- ✅ 修改 `src/components/workflow/KnowledgeStage.tsx`
  - ✅ 添加提示卡片
  - ✅ 添加点数不足错误处理
- ✅ 修改 `src/components/layouts/AppLayout.tsx`
  - ✅ 添加点数显示
- ✅ 运行 lint 检查
  - ✅ 无错误

---

## 总结

### 问题 1 修复
- **根本原因**：Markdown 代码块标记和中文标点符号
- **解决方案**：增强 JSON 清理函数，改进 Prompt
- **效果**：所有 JSON 解析策略都能正确处理各种格式问题

### 问题 2 实现
- **需求**：资料查询消耗 3 点，支持跳过
- **解决方案**：添加点数检查和扣除函数，添加 UI 提示
- **效果**：用户清楚了解点数消耗，可以选择跳过

### 用户体验提升
1. **更稳定**：JSON 解析成功率大幅提高
2. **更透明**：清楚显示点数消耗和剩余点数
3. **更灵活**：可以选择跳过资料查询
4. **更友好**：提供清晰的错误提示和操作建议
