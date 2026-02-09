# CoWrite 写作辅助工具需求文档

## 1. 应用概述

### 1.1 应用名称
CoWrite

### 1.2 应用描述
CoWrite 是一款写作辅助工具，旨在帮助用户通过结构化流程完成高质量文章创作，核心目标是减少返工、确保信息可追溯、降低 AI 检测率，并将写作过程沉淀为可复用资产。

### 1.3 核心原则
- 选题与结构必须前置
- 个人素材优先于 AI 生成
- 三遍审校不可跳过
- 所有关键节点必须用户确认
- 所有中间产物都是长期资产

## 2. 用户旅程与阶段流程

### 2.1 整体流程图
创建项目 → 明确需求 → 资料检索 → 资料整理 → 文章结构 → 段落结构 → 个人素材 → 文章生成 → 内容审校 → 排版导出 → 终版输出

### 2.2 详细阶段说明

#### 阶段 0：注册/登录
- 用户完成注册或登录
- 注册时可填写邀请码，邀请码带有对应点数，填写后赠送点数自动充值到用户账户
- 已注册用户在用户信息页面也可以填写邀请码
- 邀请码与一个用户绑定后就不能再绑定其他用户
- 邀请码一旦绑定，在管理员用户管理页面显示绑定关系
- 用户注册时填写的用户名不能重复，需要检测用户名唯一性
- 用户注册后生成对应的用户 UUID，作为唯一用户标识
- 登录成功后进入项目列表页
- 系统管理用户登录态

#### 阶段 1：项目列表与新建项目
- 展示用户的项目列表
- 支持新建项目
- 提供工具箱入口，包括：
  - 降 AI 率工具
  - 个人素材库
  - 参考文章库
  - 格式模板
- 项目状态包括：草稿、写作中、审校中、已完成
- 进度条保存历史内容，支持点击进度条中的节点，跳回到任意节点进行修改
- 进度条右侧增加需求文档图标按钮，点击后在弹窗中显示需求文档内容，所有阶段均可点击查看

#### 阶段 2：明确需求
- 用户输入文章选题/写作目标
- 选择文章类型：支持下拉已有模板选项，或新增模板
- AI 将输入结构化为需求文档，生成时参考所选格式模板中的相关内容
- 需求文档保存至 _briefs/ 文件夹，文件名格式：项目名-brief.md
- 需求文档在后续阶段起到引领作用，资料整理和文章结构生成应围绕需求文档展开
- 用户必须确认需求后才能进入下一步
- 重新点击生成需求文档后，确认按钮需重置为待确认状态
- PC端：需求文档模块右侧增加缩进/展开按钮，支持将需求文档隐藏或展开
- 移动端：无需缩进/展开按钮
- 跳转至资料检索页时：需求文档不再显示在页面右侧，改为在进度条右侧显示需求文档图标按钮，点击后在弹窗中显示需求文档内容

#### 阶段 3：资料检索

**资料检索页面设计**

页面结构：
```
ResearchRetrievalPage
├─ RetrievalHeader（检索概览）
├─ SearchPanel（搜索面板）
│  ├─ KeywordInput（关键词输入）
│  └─ DataSourceSelector（数据源选择）
├─ ResultsPanel（检索结果面板）
│  └─ ResultCards（资料卡片列表）
│      ├─ ResultCard
│      │   ├─ 资料标题
│      │   ├─ 资料 URL
│      │   ├─ 原文内容预览
│      │   └─ 用户操作区（选择/忽略）
└─ BottomActionBar（底部操作栏）
    └─ 确认并进入下一步按钮
```

功能说明：
- Research Retrieval Agent 在对应数据源搜索相关关键词
- 获取资料标题、URL，并从 URL 中提取原文
- 将检索结果展现在页面上
- 用户可点击需要的资料进行选择

确认条件：
- 用户完成资料选择后，确认并进入下一步按钮启用
- 点击后保存用户选择的资料，进入资料整理阶段

#### 阶段 4：资料整理

**资料整理页面设计**

页面结构：
```
ResearchSynthesisPage
├─ SynthesisHeader（整理概览）
├─ InsightsPanel（洞察面板）
│  ├─ CategoryTabs（分类标签）
│  └─ InsightCards（洞察卡片列表）
│      ├─ InsightCard
│      │   ├─ 核心洞察
│      │   ├─ 支持数据
│      │   ├─ 推荐用途标签
│      │   ├─ 局限性说明
│      │   ├─ 用户判断输入框（用户填写观点是否可取）
│      │   └─ 用户操作区（选择/排除/降级）
├─ ContradictionsPanel（矛盾与空白面板）
│  └─ GapCards（矛盾/空白卡片列表）
│      ├─ GapCard
│      │   ├─ 问题描述
│      │   └─ 用户操作区（响应/忽略）
└─ BottomActionBar（底部操作栏）
    └─ 确认并进入下一步按钮
```

功能说明：
- 调用 Research Synthesis Agent 整理用户在资料检索阶段选择的资料
- 显示对应观点、数据等内容
- 用户可进一步填写自己的判断，评价观点是否可取

用户操作：
- 对每条洞察，用户可选择：
  - 必须使用（must_use）
  - 作为背景（background）
  - 排除（excluded）
- 对每条洞察，用户可填写自己的判断（观点是否可取）
- 对每个矛盾/空白，用户可选择：
  - 响应（respond）
  - 忽略（ignore）

确认条件：
- 用户完成所有洞察的选择和判断填写后，确认并进入下一步按钮启用
- 点击后保存用户决策，进入文章结构生成阶段

#### 阶段 5：文章结构生成
- 基于需求文档和用户在资料整理阶段的决策，生成文章结构
- 用户可对文章结构进行确认、调整或重新生成

#### 阶段 6：段落结构
- 逐段生成段落结构
- 用户对每个段落进行确认或修改

#### 阶段 7：个人素材
- 用户可从个人素材库中选择相关素材
- 支持添加新的个人素材

#### 阶段 8：文章生成
- 基于前述所有阶段的内容，生成完整文章
- 用户可对文章进行审校和修改

#### 阶段 9：内容审校
- 提供三遍审校流程
- 用户逐步完成审校并确认

#### 阶段 10：排版导出
- 支持多种格式导出
- 用户可选择导出格式并完成导出

#### 阶段 11：终版输出
- 最终版本确认
- 项目状态更新为已完成

## 3. 写作状态管理（WritingState）

### 3.1 WritingState 对象

WritingState 是整个系统的中枢，用于管理写作流程的状态和用户决策。

```typescript
WritingState {
  session_id: string
  current_stage: 'retrieval' | 'synthesis' | 'structure' | 'paragraph' | 'evidence' | 'writing'
  
  locked: {
    core_thesis: boolean
    structure: boolean
  }
  
  user_decisions: {
    retrieval?: RetrievalDecision
    synthesis?: SynthesisDecision
    structure?: StructureDecision
    paragraph?: ParagraphDecision[]
    evidence?: EvidenceDecision[]
  }
  
  timestamps: {
    created_at: string
    updated_at: string
  }
}
```

核心原则：
- Agent 永远只读 WritingState
- 不猜用户意图，不假设用户同意
- 任何阶段没有用户决策，不允许进入下一阶段

### 3.2 用户决策对象

#### RetrievalDecision（资料检索决策）
```typescript
RetrievalDecision {
  selected_materials: [
    {
      material_id: string
      title: string
      url: string
      content: string
    }
  ]
}
```

#### SynthesisDecision（资料整理决策）
```typescript
SynthesisDecision {
  insights: [
    {
      insight_id: string
      usage: 'must_use' | 'background' | 'excluded'
      user_judgment: string
    }
  ]
  gaps: [
    {
      gap_id: string
      action: 'respond' | 'ignore'
    }
  ]
}
```

#### StructureDecision（文章结构决策）
```typescript
StructureDecision {
  core_thesis_confirmed: boolean
  core_thesis_override?: string
  removed_blocks: string[]
  reordered_blocks: string[]
}
```

#### ParagraphDecision（段落结构决策）
```typescript
ParagraphDecision {
  paragraph_id: string
  action: 'accept' | 'revise' | 'skip'
  revise_type?: 'logic' | 'experience' | 'counter'
}
```

#### EvidenceDecision（证据选择决策）
```typescript
EvidenceDecision {
  sub_claim_id: string
  selected_evidence_ids: string[]
}
```

### 3.3 GuidanceContext（引导词上下文）

GuidanceContext 用于给引导词 Agent 提供输入信息。

```typescript
GuidanceContext {
  stage: string
  completion_status: string
  user_actions_summary: string
  next_required_action: string
  lock_status: object
}
```

## 4. Agent 调度逻辑

### 4.1 流程控制

新的 Agent 调度逻辑采用状态机式流程控制：

```
Retrieval（资料检索）
  ↓
等待用户 RetrievalDecision
  ↓
Synthesis（资料整理）
  ↓
等待用户 SynthesisDecision
  ↓
Structure（文章结构）
  ↓
等待用户 StructureDecision
  ↓
Paragraph（段落结构，逐段）
  ↓
等待对应 ParagraphDecision
  ↓
Evidence（证据选择）
  ↓
等待 EvidenceDecision
  ↓
Writing（文章生成）
```

关键规则：
- 任何阶段没有用户决策，不允许进入下一阶段
- 每个阶段的 Agent 只读取 WritingState，不做假设
- 用户决策保存后，才能触发下一阶段 Agent

### 4.2 前端状态驱动

前端采用状态机式渲染，核心判断逻辑：

```javascript
if (stage === 'retrieval' && !userDecision.retrieval) {
  showRetrievalSelection()
}

if (stage === 'synthesis' && !userDecision.synthesis) {
  showSynthesisSelection()
}

if (stage === 'structure' && !locked.structure) {
  showStructureEditor()
}
```

每个 Agent 结果页必须包含三块 UI：
1. AI 生成结果
2. 用户操作区
3. AI 引导词（Guidance Agent）

引导词是独立接口返回，不是写死文案。

### 4.3 前端操作类型

前端只做 3 类操作：
1. 选择：勾选研究洞察
2. 确认：接受核心论点
3. 排序/删除：拖拽论证块

禁止操作：
- 不让用户改长文本
- 不让用户重写

## 5. 接口设计

### 5.1 提交资料检索决策
```
POST /writing/decision/retrieval
{
  \"session_id\": \"...\",
  \"decisions\": {
    \"selected_materials\": [
      {
        \"material_id\": \"m1\",
        \"title\": \"...\",
        \"url\": \"...\",
        \"content\": \"...\"
      }
    ]
  }
}
```

### 5.2 提交资料整理决策
```
POST /writing/decision/synthesis
{
  \"session_id\": \"...\",
  \"decisions\": {
    \"insights\": [
      {
        \"insight_id\": \"i1\",
        \"usage\": \"must_use\",
        \"user_judgment\": \"观点可取，数据支持充分\"
      },
      {
        \"insight_id\": \"i2\",
        \"usage\": \"excluded\",
        \"user_judgment\": \"观点存在偏差\"
      }
    ],
    \"gaps\": [
      { \"gap_id\": \"g1\", \"action\": \"respond\" }
    ]
  }
}
```

### 5.3 请求下一阶段 Agent
```
POST /writing/agent/structure
{
  \"session_id\": \"...\"
}
```

### 5.4 获取引导词
```
POST /writing/guidance
{
  \"session_id\": \"...\",
  \"stage\": \"structure\"
}
```

## 6. 管理员功能

### 6.1 用户管理

#### 6.1.1 邀请码生成功能
- 管理员在用户管理页面可生成随机8位邀请码
- 生成邀请码时可设置邀请码对应的点数
- 邀请码生成后可分享给新用户注册使用

#### 6.1.2 用户权限管理
- 管理员账户拥有无限点数
- 管理员可为每个用户配置点数
- 系统记录每个用户的：
  - AI降重工具已使用次数
  - 已创建项目数量
- 当用户点数不足时，系统显示提示：点数不够需要购买点数

#### 6.1.3 邀请码绑定关系显示
- 在管理员用户管理页面显示邀请码与用户的绑定关系

## 7. 用户功能

### 7.1 用户信息显示

#### 7.1.1 使用情况
- 可用点数：显示用户当前可用点数余额
- 项目配额：单行显示已创建项目数量和AI降重已使用次数

#### 7.1.2 新用户初始配额
- 每个新用户可创建一个项目
- 每个新用户可使用一次AI降重工具

### 7.2 点数购买

#### 7.2.1 购买入口
- 在设置页面的用户信息模块中，新增点数购买功能
- 点击后显示点数套餐选择弹窗

#### 7.2.2 点数套餐
点数套餐及价格如下：
- 体验包：16 点，¥9.9
- 推荐包 ⭐：66 点，¥29.9
- 进阶包：166 点，¥79.9
- 专业包：366 点，¥149.9

#### 7.2.3 购买页面设计要求
- 调整购买点数页面字号大小，保证内容不紧凑，提升视觉舒适度

#### 7.2.4 购买流程
- 用户在弹窗中选择套餐后点击购买按钮
- 完成支付后，点数自动充值到用户账户
- 用户可使用点数兑换 AI降重工具使用次数或创建项目权限

## 8. 参考文件

1. 上传图片：image.png
2. 上传图片：image-2.png
3. 上传图片：image-3.png