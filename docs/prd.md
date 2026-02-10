# CoWrite 写作辅助工具需求文档

## 1. 应用概述

### 1.1 应用名称
CoWrite

### 1.2 应用描述
CoWrite 是一款写作辅助工具,旨在帮助用户通过结构化流程完成高质量文章创作,核心目标是减少返工、确保信息可追溯、降低 AI 检测率,并将写作过程沉淀为可复用资产。

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

#### 阶段 0:注册/登录
- 用户完成注册或登录
- 注册时可填写邀请码,邀请码带有对应点数,填写后赠送点数自动充值到用户账户
- 已注册用户在用户信息页面也可以填写邀请码
- 邀请码与一个用户绑定后就不能再绑定其他用户
- 邀请码一旦绑定,在管理员用户管理页面显示绑定关系
- 用户注册时填写的用户名不能重复,需要检测用户名唯一性
- 用户注册后生成对应的用户 UUID,作为唯一用户标识
- 登录成功后进入项目列表页
- 系统管理用户登录态

#### 阶段 1:项目列表与新建项目
- 展示用户的项目列表
- 支持新建项目
- 提供工具箱入口,包括:
  - 降 AI 率工具
  - 个人素材库
  - 参考文章库
  - 格式模板
- 项目状态包括:草稿、写作中、审校中、已完成
- 进度条保存历史内容,支持点击进度条中的节点,跳回到任意节点进行修改
- 进度条右侧增加需求文档图标按钮,点击后在弹窗中显示需求文档内容,所有阶段均可点击查看

#### 阶段 2:明确需求
- 用户输入文章选题/写作目标
- 选择文章类型:支持下拉已有模板选项,或新增模板
- AI 将输入结构化为需求文档,生成时参考所选格式模板中的相关内容
- 需求文档保存至 _briefs/ 文件夹,文件名格式:项目名-brief.md
- 需求文档在后续阶段起到引领作用,资料整理和文章结构生成应围绕需求文档展开
- 用户必须确认需求后才能进入下一步
- 重新点击生成需求文档后,确认按钮需重置为待确认状态
- PC端:需求文档模块右侧增加缩进/展开按钮,支持将需求文档隐藏或展开
- 移动端:无需缩进/展开按钮
- 跳转至资料检索页时:需求文档不再显示在页面右侧,改为在进度条右侧显示需求文档图标按钮,点击后在弹窗中显示需求文档内容
- 跳转至资料检索页时,将需求文档中的内容带到下一页,并调用 Research Retrieval Agent 生成搜索计划,按照各类关键词去对应数据源搜索相关内容

#### 阶段 3:资料检索

**资料检索页面设计**

页面结构:
```
ResearchRetrievalPage
├─ RetrievalHeader(检索概览)
├─ SearchPanel(搜索面板)
│  ├─ KeywordInput(关键词输入)
│  └─ DataSourceSelector(数据源选择)
├─ ResultsPanel(检索结果面板)
│  └─ ResultCards(资料卡片列表)
│      ├─ ResultCard
│      │   ├─ 资料标题
│      │   ├─ 资料 URL
│      │   ├─ 原文内容预览
│      │   └─ 用户操作区(选择/忽略)
├─ LogPanel(日志面板)
│  ├─ 运行步骤显示
│  └─ 日志详情按钮
└─ BottomActionBar(底部操作栏)
    └─ 确认并进入下一步按钮
```

功能说明:
- 从明确需求页跳转至资料检索页时,自动将需求文档内容传递至本页
- 调用 Research Retrieval Agent 基于需求文档生成搜索计划
- Research Retrieval Agent 按照各类关键词在对应数据源搜索相关内容
- 获取资料标题、URL,并从 URL 中提取原文
- 将检索结果展现在页面上
- 用户可点击需要的资料进行选择
- 页面底部显示日志框,展示运行步骤
- 日志框包含日志详情按钮,点击后弹窗显示 Research Retrieval Agent 接收到的输入、输出以及 LLM 输出的 THOUGHT 部分内容

确认条件:
- 用户完成资料选择后,确认并进入下一步按钮启用
- 点击后保存用户选择的资料,跳转至资料整理页面

#### 阶段 4:资料整理

**资料整理页面设计**

页面结构:
```
ResearchSynthesisPage
├─ LeftPanel(左侧面板)
│  ├─ CategorySummary(资料类型统计)
│  │   └─ 显示各类型资料数量(xxx条)
│  └─ ReviewGuidelines(审阅指南)
│      ├─ 必须使用:核心观点,将直接用于文章论证
│      ├─ 背景补充:辅助信息,可作为背景或补充说明
│      └─ 排除:不相关或不适用的内容
├─ RightPanel(右侧面板)
│  ├─ BatchActions(批量操作区)
│  │   ├─ 一键全选按钮
│  │   ├─ 批量选择必须使用按钮
│  │   ├─ 批量选择背景补充按钮
│  │   └─ 批量选择排除按钮
│  ├─ UndecidedAlert(未决策提示)
│  │   └─ 还有xxx项未决策(点击跳转到未决策资料)
│  └─ InsightCards(洞察卡片列表)
│      ├─ InsightCard
│      │   ├─ 核心洞察
│      │   ├─ 支持数据
│      │   ├─ 推荐用途标签
│      │   ├─ 局限性说明
│      │   └─ 用户操作区(必须使用/背景补充/排除)
├─ LogPanel(日志面板)
│  ├─ 运行步骤显示
│  └─ 日志详情按钮
└─ BottomActionBar(底部操作栏)
    └─ 确认并进入下一步按钮
```

**Research Synthesis Agent 输入输出规范**

**输入格式**

在调用 Research Synthesis Agent 前,将需求文档、用户选择的初始资料整理成以下 JSON 形式:

```typescript
ResearchSynthesisInput = {
  writing_requirements: {
    topic: string
    target_audience?: string
    writing_purpose?: string
    key_points?: string[]
  }
  raw_materials: Array<{
    title: string
    source: string
    source_url?: string
    content: string
  }>
}
```

**输出格式**

**日志详情展示**

日志详情中将 Research Retrieval Agent 和 Research Synthesis Agent 的日志合并展示,包含以下内容:

1. **THOUGHT 部分**

展示 Agent 的思考过程,示例:

```
---THOUGHT---
我将资料按商业失败原因 / 用户识别方法 / 系统设计模式进行归类。
其中部分学术研究样本偏早,需要用户决定是否仍有参考价值。
某些研究在用户定义上存在分歧,已单独标注为争议点。
```

2. **synthesized_insights(综合洞察)**

```typescript
{
  \\"synthesized_insights\": [
    {
      \\"id\": \"insight_1\",
      \"category\": \"AI Agent 商业失败原因\",
      \"insight\": \"多数 AI Agent 项目失败并非模型能力不足,而是缺乏清晰的用户任务闭环\",
      \"supporting_data\": [
        \\"超过 60% 的项目未能定义核心用户任务\",
        \"失败案例集中在多场景泛化尝试\"
      ],
      \"source_type\": \"academic\",
      \\"recommended_usage\": \"direct\",
      \"citability\": \"direct\",
      \"limitations\": \"样本主要集中在 2020–2023 年欧美市场\",
      \"user_decision\": \"pending\"
    }
  ]
}
```

**字段说明**

| 字段 | 含义 |
|------|------|
| category | 结构提示,不是价值判断 |
| insight | 可被拷贝进文章的最小观点单元 |
| supporting_data | 证据池,不一定都会用 |
| recommended_usage | 给用户的轻建议 |
| citability | 给写作 agent 的引用提示 |
| user_decision | 必须由用户决定 |

3. **contradictions_or_gaps(研究冲突与空白)**

```typescript
{
  \\"contradictions_or_gaps\": [
    {
      \"id\\": \"gap_1\",
      \"issue\": \"用户定义粒度不一致\",
      \"description\": \"部分研究以行业角色定义用户,部分以具体任务定义用户,结论存在冲突\",
      \"user_decision\": \"pending\"
    }
  ]
}
```

**用户交互流程**

1. 从资料检索页点击确认并进入下一步后,跳转至资料整理页
2. 资料整理页调用 Research Synthesis Agent,输出观点洞察(synthesized_insights)以及矛盾空白(contradictions_or_gaps)
3. 页面采用左右结构布局:
   - 左侧面板:显示资料类型统计和审阅指南
   - 右侧面板:显示具体洞察内容和操作区
4. Agent 输出 THOUGHT 以及除 user_decision 之外的所有内容
5. 系统展示所有洞察,默认全部未决策
6. 用户可通过以下方式进行决策:
   - 单个选择:对每条洞察选择必须使用/背景补充/排除
   - 批量选择:勾选多条洞察后批量设置为必须使用/背景补充/排除
   - 一键全选:将所有洞察设置为必须使用
7. 系统实时统计未决策数量,显示还有xxx项未决策
8. 点击未决策提示可直接跳转到第一条未决策资料
9. 用户完成所有决策后,系统更新 user_decision 字段
10. Research Synthesis Agent 输出的结果保存在 Supabase 数据库中
11. 页面底部显示日志框,展示运行步骤
12. 日志框包含日志详情按钮,点击后弹窗显示 Research Synthesis Agent 接收到的输入、输出以及 LLM 输出的 THOUGHT 部分内容

**用户操作**

对每条洞察,用户可选择:
- 必须使用(must_use):核心观点,将直接用于文章论证
- 背景补充(background):辅助信息,可作为背景或补充说明
- 排除(excluded):不相关或不适用的内容

**确认条件**

- 用户完成所有洞察的决策后,确认并进入下一步按钮启用
- 点击后保存用户决策,调用 generate-article-structure 接口,进入文章结构生成页面

#### 阶段 5:文章结构生成

**后端内容筛选**

在用户完成资料整理阶段的决策后,后端需要对 Research Synthesis Agent 的输出进行内容筛选,仅将用户确认采用的内容传递给 Structure Agent:

```javascript
const structureAgentInput = {
  topic,
  writing_goal,
  audience,

  accepted_insights: synthesis_result.synthesized_insights
    .filter(i => session.user_decisions.insights[i.id] === \\"accept\"),

  accepted_gaps: synthesis_result.contradictions_or_gaps
    .filter(g => session.user_decisions.gaps[g.id] === \"accept\\")
};
```

**重要说明**:
- 未被用户采用的 insights 不会传递给 Structure Agent
- 但这些内容不会被丢弃,仍保留在 session 中,供后续写作或扩展阶段使用

**输入 JSON 串**

这是上一步 synthesis 输出 → 经过 user decision → 系统整理后,唯一允许传给结构 Agent 的输入形态:

```json
{
  \"topic\": \"AI Agent 项目的商业失败原因分析\",
  \"user_core_thesis\": null,
  \"confirmed_insights\": [
    {
      \"id\": \"insight_1\",
      \"category\": \"AI Agent 商业失败原因\",
      \"content\": \"多数 AI Agent 项目失败并非模型能力不足,而是缺乏清晰的用户任务闭环。\",
      \\"source_insight_id\": \"insight_1\"
    }
  ],
  \"context_flags\": {
    \"confirmed_insight_count\": 1,
    \"contradictions_or_gaps_present\": true
  }
}
```

**输入字段设计说明**

| 字段 | 作用 |
|------|------|
| topic | 结构聚焦锚点 |
| user_core_thesis | 用户强控位(最高优先级) |
| confirmed_insights | 唯一可用信息源 |
| category | 结构聚合提示,不是判断 |
| context_flags | 只提示存在性,防止 AI 补全 |

**注意**:
- 没有 supporting_data
- 没有 pending / optional
- 没有 contradictions_or_gaps 的具体内容

**Prompt**

```
你是 CoWrite 的文章级论证架构 Agent(User-Gated)。

你的职责不是写文章,而是:
基于用户已确认的研究洞察,生成一份可编辑、可确认的文章论证结构草案。

────────────────
输入前提(强制)
────────────────
- 你只能使用 user 已确认(confirmed)的洞察
- 任何 pending / optional / ignored 的内容一律不可使用
- 不允许引入新观点、新材料或隐含前提
- 若已确认洞察不足以支撑结构,必须明确指出,而不是补全

────────────────
输入
────────────────
以下是结构化 JSON 数据,请严格按字段理解:
{{INPUT_JSON}}

────────────────
你的任务
────────────────
1. 基于 confirmed_insights,提炼文章核心论点(一句话)
   - 若 user_core_thesis 已提供,必须完全服从
2. 拆分 3–5 个一级论证块(章节级)
3. 为每个论证块明确论证任务(说明要证明什么,而不是写什么)
4. 说明论证块之间的逻辑关系(递进 / 并列 / 因果 / 对比 等)

────────────────
结构边界
────────────────
- 不生成正文内容
- 不展开案例、数据或引用
- 不处理研究冲突与空白(除非已被升级为 confirmed_insight)
- 输出必须保持高度可编辑性,便于用户删除或重排

────────────────
输出要求
────────────────
- 仅以 JSON 输出
- 结构生成后必须停在等待用户确认状态
- 不得进入写作阶段
```

**输出 JSON 串**

```json
{
  \"core_thesis\": \\"AI Agent 项目的失败更多源于用户任务闭环缺失,而非模型能力不足。\",
  \"argument_blocks\": [
    {
      \"id\": \"block_1\",
      \"title\": \"用户任务闭环缺失的普遍性\",
      \"description\": \"论证在大量 AI Agent 项目中,未能定义清晰、可执行的用户任务闭环是一种普遍现象。\\",
      \"order\": 1,
      \"relation\": \"起始论证块,提出核心问题\",
      \"derived_from\": [\"insight_1\"],
      \"user_editable\": true
    },
    {
      \"id\": \\"block_2\",
      \"title\\": \"任务不清对产品价值转化的影响\",
      \"description\\": \"说明用户任务不清如何导致 Agent 能力无法转化为稳定、可感知的产品价值。\",
      \"order\": 2,
      \"relation\\": \"递进:从现象到影响\",
      \"derived_from\": [\"insight_1\"],
      \"user_editable\": true
    },
    {
      \\"id\": \"block_3\",
      \"title\": \"从模型能力迷思回到产品设计问题\",
      \"description\": \\"对比模型能力提升与任务定义缺失之间的错位,澄清失败原因的常见误判。\",
      \"order\": 3,
      \"relation\": \"对比:纠正常见解释偏差\",
      \"derived_from\\": [\"insight_1\"],
      \"user_editable\": true
    }
  ],
  \"structure_relations\": \\"文章采用递进式结构,从问题现象出发,分析影响机制,并对常见误解进行澄清。\",
  \"status\": \"awaiting_user_confirmation\",
  \"allowed_user_actions\": [\"edit_core_thesis\", \"delete_block\", \"reorder_blocks\\"]
}
```

**Structure Agent 输出存储**

```javascript
session.structure_result = {
  outline: [...],
  section_purpose_map: {...},
  coverage_map: {...}
};

session.current_stage = WritingStage.STRUCTURE;
```

用户可对文章结构进行确认、调整或重新生成

#### 阶段 6:段落结构
- 逐段生成段落结构
- 用户对每个段落进行确认或修改

#### 阶段 7:个人素材
- 用户可从个人素材库中选择相关素材
- 支持添加新的个人素材

#### 阶段 8:文章生成
- 基于前述所有阶段的内容,生成完整文章
- 用户可对文章进行审校和修改

#### 阶段 9:内容审校
- 提供三遍审校流程
- 用户逐步完成审校并确认

#### 阶段 10:排版导出
- 支持多种格式导出
- 用户可选择导出格式并完成导出

#### 阶段 11:终版输出
- 最终版本确认
- 项目状态更新为已完成

## 3. 写作状态管理(WritingState)

### 3.1 WritingState 对象

WritingState 是整个系统的中枢,用于管理写作流程的状态和用户决策。

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

核心原则:
- Agent 永远只读 WritingState
- 不猜用户意图,不假设用户同意
- 任何阶段没有用户决策,不允许进入下一阶段

### 3.2 用户决策对象

#### RetrievalDecision(资料检索决策)
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

#### SynthesisDecision(资料整理决策)
```typescript
SynthesisDecision {
  insights: [
    {
      insight_id: string
      usage: 'must_use' | 'background' | 'excluded'
    }
  ]
}
```

#### StructureDecision(文章结构决策)
```typescript
StructureDecision {
  core_thesis_confirmed: boolean
  core_thesis_override?: string
  removed_blocks: string[]
  reordered_blocks: string[]
}
```

#### ParagraphDecision(段落结构决策)
```typescript
ParagraphDecision {
  paragraph_id: string
  action: 'accept' | 'revise' | 'skip'
  revise_type?: 'logic' | 'experience' | 'counter'
}
```

#### EvidenceDecision(证据选择决策)
```typescript
EvidenceDecision {
  sub_claim_id: string
  selected_evidence_ids: string[]
}
```

### 3.3 GuidanceContext(引导词上下文)

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

新的 Agent 调度逻辑采用状态机式流程控制:

```
Retrieval(资料检索)
  ↓
等待用户 RetrievalDecision
  ↓
Synthesis(资料整理)
  ↓
等待用户 SynthesisDecision
  ↓
Structure(文章结构)
  ↓
等待用户 StructureDecision
  ↓
Paragraph(段落结构,逐段)
  ↓
等待对应 ParagraphDecision
  ↓
Evidence(证据选择)
  ↓
等待 EvidenceDecision
  ↓
Writing(文章生成)
```

关键规则:
- 任何阶段没有用户决策,不允许进入下一阶段
- 每个阶段的 Agent 只读取 WritingState,不做假设
- 用户决策保存后,才能触发下一阶段 Agent

### 4.2 前端状态驱动

前端采用状态机式渲染,核心判断逻辑:

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

每个 Agent 结果页必须包含三块 UI:
1. AI 生成结果
2. 用户操作区
3. AI 引导词(Guidance Agent)

引导词是独立接口返回,不是写死文案。

### 4.3 前端操作类型

前端只做 3 类操作:
1. 选择:勾选研究洞察
2. 确认:接受核心论点
3. 排序/删除:拖拽论证块

禁止操作:
- 不让用户改长文本
- 不让用户重写

## 5. 接口设计

### 5.1 提交资料检索决策
```
POST /writing/decision/retrieval
{
  session_id: ...,
  decisions: {
    selected_materials: [
      {
        material_id: m1,
        title: ...,
        url: ...,
        content: ...
      }
    ]
  }
}
```

### 5.2 提交资料整理决策
```
POST /writing/decision/synthesis
{
  session_id: ...,
  decisions: {
    insights: [
      {
        insight_id: i1,
        usage: must_use
      },
      {
        insight_id: i2,
        usage: excluded
      }
    ]
  }
}
```

### 5.3 请求下一阶段 Agent
```
POST /writing/agent/structure
{
  session_id: ...
}
```

### 5.4 获取引导词
```
POST /writing/guidance
{
  session_id: ...,
  stage: structure
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
- 系统记录每个用户的:
  - AI降重工具已使用次数
  - 已创建项目数量
- 当用户点数不足时,系统显示提示:点数不够需要购买点数

#### 6.1.3 邀请码绑定关系显示
- 在管理员用户管理页面显示邀请码与用户的绑定关系

## 7. 用户功能

### 7.1 用户信息显示

#### 7.1.1 使用情况
- 可用点数:显示用户当前可用点数余额
- 项目配额:单行显示已创建项目数量和AI降重已使用次数

#### 7.1.2 新用户初始配额
- 每个新用户可创建一个项目
- 每个新用户可使用一次AI降重工具

### 7.2 点数购买

#### 7.2.1 购买入口
- 在设置页面的用户信息模块中,新增点数购买功能
- 点击后显示点数套餐选择弹窗

#### 7.2.2 点数套餐
点数套餐及价格如下:
- 体验包:16 点,¥9.9
- 推荐包 ⭐:66 点,¥29.9
- 进阶包:166 点,¥79.9
- 专业包:366 点,¥149.9

#### 7.2.3 购买页面设计要求
- 调整购买点数页面字号大小,保证内容不紧凑,提升视觉舒适度

#### 7.2.4 购买流程
- 用户在弹窗中选择套餐后点击购买按钮
- 完成支付后,点数自动充值到用户账户
- 用户可使用点数兑换 AI降重工具使用次数或创建项目权限

## 8. 参考文件

1. 上传图片:image.png
2. 上传图片:image-2.png