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

---

## 2. 用户旅程与阶段流程

### 2.1 整体流程图
注册/登录 → 项目列表 → 需求明确 → 资料搜索 → 资料整理 → 文章结构 → 生成草稿 → 内容审校 → 排版导出

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
- **创建项目时消耗 9 点**

#### 阶段 2：需求明确
- 用户输入文章选题/写作目标
- 选择文章类型：支持下拉已有模板选项，或新增模板
- 调用 **brief-agent** 将输入结构化为需求文档（**writing_brief**），生成时参考所选格式模板中的相关内容
- 需求文档保存至 _briefs/ 文件夹，文件名格式：项目名-brief.md
- 需求文档在后续阶段起到引领作用，资料整理和文章结构生成应围绕需求文档展开
- 用户必须确认需求后才能进入下一步
- 重新点击生成需求文档后，确认按钮需重置为待确认状态
- PC端：需求文档模块右侧增加缩进/展开按钮，支持将需求文档隐藏或展开
- 移动端：无需缩进/展开按钮
- 跳转至资料搜索页时：需求文档不再显示在页面右侧，改为在进度条右侧显示需求文档图标按钮，点击后在弹窗中显示需求文档内容
- **完稿之后无法再更改需求文档**

**需求文档 Payload 格式（writing_brief）**

```json
{
  \"project_id\": \"uuid\",
  \"topic\": \"文章主题\",
  \"user_core_thesis\": \"用户核心论点（可选）\",
  \"requirement_meta\": {
    \"document_type\": \"academic / blog / report / speech\",
    \"target_audience\": \"目标读者群体\",
    \"language\": \"zh-CN / en-US\",
    \"citation_style\": \"APA / MLA / none\",
    \"word_limit\": 3000,
    \"seo_mode\": false,
    \"tone\": \"formal / casual / professional\",
    \"writing_depth\": \"shallow / medium / deep\"
  },
  \"confirmed_insights\": [],
  \"version\": 1,
  \"created_at\": \"timestamp\"
}
```

#### 阶段 3：资料搜索

**点数消耗规则**
- 创建项目时已消耗 9 点，资料搜索与资料整理阶段不再额外消耗点数
- 用户可选择跳过资料搜索和资料整理，直接进入文章结构生成阶段
- 跳过时系统提示：若不是学术性论文，可不做资料搜索和整理，直接生成文章结构
- **点击刷新重新搜索资料需要额外消耗 1 点**

**资料搜索页面设计**

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
├─ LogPanel（日志面板）
│  ├─ 运行步骤显示
│  └─ 日志详情按钮
└─ BottomActionBar（底部操作栏）
    ├─ 跳过按钮
    └─ 确认并进入下一步按钮
```

功能说明：
- 从需求明确页跳转至资料搜索页时，自动将需求文档内容传递至本页
- 调用 **research-agent** 的 **research_retrieval** 函数基于需求文档生成搜索计划
- research_retrieval 按照各类关键词在对应数据源搜索相关内容
- 获取资料标题、URL，并从 URL 中提取原文
- 将检索结果展现在页面上
- 用户可点击需要的资料进行选择
- 页面底部显示日志框，展示运行步骤
- 日志框包含日志详情按钮，点击后弹窗显示 research_retrieval 接收到的输入、输出以及 LLM 输出的 THOUGHT 部分内容

**个人资料库整合**
- 资料搜索阶段同时检索外部资料与个人资料库
- 个人资料库内容必须先做：
  - 关键词匹配
  - 向量搜索
  - top-k 选取
  - 摘要压缩
- 只传：top 5–8 个高度相关摘要输入
- **禁止全文拼接**

确认条件：
- 用户完成资料选择后，确认并进入下一步按钮启用
- 点击后保存用户选择的资料，跳转至资料整理页面
- 用户点击跳过按钮后，直接跳转至文章结构生成页面

**资料搜索 Payload 格式（research_sources）**

```json
{
  \"id\": \"uuid\",
  \"project_id\": \"uuid\",
  \"title\": \"资料标题\",
  \"content\": \"资料全文\",
  \"summary\": \"资料摘要\",
  \"source_url\": \"来源链接\",
  \"source_type\": \"academic / news / blog / personal\",
  \"credibility_score\": 0.85,
  \"recency_score\": 0.92,
  \"relevance_score\": 0.88,
  \"embedding_vector\": \"向量索引\",
  \"token_length\": 1500,
  \"chunk_index\": 0,
  \"tags\": [\"关键词1\", \"关键词2\"],
  \"created_at\": \"timestamp\"
}
```

#### 阶段 4：资料整理

**点数消耗规则**
- 创建项目时已消耗 9 点，资料整理阶段不再额外消耗点数
- 仅当用户完成资料整理并确认进入下一步时，才进入文章结构生成阶段
- 若用户在资料搜索阶段选择跳过，则不进入资料整理阶段

**资料整理页面设计**

页面结构：
```
ResearchSynthesisPage
├─ LeftPanel（左侧面板）
│  ├─ CategorySummary（资料类型统计）
│  │   └─ 显示各类型资料数量（xxx条）
│  └─ ReviewGuidelines（审阅指南）
│      ├─ 必须使用：核心观点，将直接用于文章论证
│      ├─ 背景补充：辅助信息，可作为背景或补充说明
│      └─ 排除：不相关或不适用的内容
├─ RightPanel（右侧面板）
│  ├─ BatchActions（批量操作区）
│  │   ├─ 一键全选按钮
│  │   ├─ 批量选择必须使用按钮
│  │   ├─ 批量选择背景补充按钮
│  │   └─ 批量选择排除按钮
│  ├─ UndecidedAlert（未决策提示）
│  │   └─ 还有xxx项未决策（点击跳转到未决策资料）
│  └─ InsightCards（洞察卡片列表）
│      ├─ InsightCard
│      │   ├─ 核心洞察
│      │   ├─ 支持数据
│      │   ├─ 推荐用途标签
│      │   ├─ 局限性说明
│      │   └─ 用户操作区（必须使用/背景补充/排除）
├─ LogPanel（日志面板）
│  ├─ 运行步骤显示
│  └─ 日志详情按钮
└─ BottomActionBar（底部操作栏）
    └─ 确认并进入下一步按钮
```

**research-agent 的 research_synthesis 函数输入输出规范**

**输入格式**

在调用 research_synthesis 前，将需求文档、用户选择的初始资料整理成以下 JSON 形式：

```json
{
  \"writing_requirements\": {
    \"topic\": \"文章主题\",
    \"target_audience\": \"目标读者\",
    \"writing_purpose\": \"写作目的\",
    \"key_points\": [\"要点1\", \"要点2\"]
  },
  \"raw_materials\": [
    {
      \"title\": \"资料标题\",
      \"source\": \"来源\",
      \"source_url\": \"链接\",
      \"content\": \"资料内容\"
    }
  ]
}
```

**输出格式**

research_synthesis 必须严格输出纯 JSON 格式，不得包含任何 Markdown 代码块标记（如 ```json 或 ```）。输出内容必须直接以 { 开头，以 } 结尾，确保可被标准 JSON 解析器直接解析。

**日志详情展示**

日志详情中将 research_retrieval 和 research_synthesis 的日志合并展示，包含以下内容：

1. **THOUGHT 部分**

展示 Agent 的思考过程，示例：

```
---THOUGHT---
我将资料按商业失败原因 / 用户识别方法 / 系统设计模式进行归类。
其中部分学术研究样本偏早，需要用户决定是否仍有参考价值。
某些研究在用户定义上存在分歧，已单独标注为争议点。
```

2. **synthesized_insights（综合洞察）**

```json
{
  \"synthesized_insights\": [
    {
      \"id\": \"insight_1\",
      \"category\": \"AI Agent 商业失败原因\",
      \"insight\": \"多数 AI Agent 项目失败并非模型能力不足，而是缺乏清晰的用户任务闭环\",
      \"supporting_data\": [
        \"超过 60% 的项目未能定义核心用户任务\",
        \"失败案例集中在多场景泛化尝试\"
      ],
      \"source_type\": \"academic\",
      \"recommended_usage\": \"direct\",
      \"citability\": \"direct\",
      \"limitations\": \"样本主要集中在 2020–2023 年欧美市场\",
      \"user_decision\": \"pending\",
      \"supporting_source_ids\": [\"source_id_1\", \"source_id_2\"],
      \"evidence_strength\": \"strong\",
      \"risk_flag\": false,
      \"confidence_score\": 0.89
    }
  ]
}
```

**字段说明**

| 字段 | 含义 |
|------|------|
| category | 结构提示，不是价值判断 |
| insight | 可被拷贝进文章的最小观点单元 |
| supporting_data | 证据池，不一定都会用 |
| recommended_usage | 给用户的轻建议 |
| citability | 给写作 agent 的引用提示 |
| user_decision | 必须由用户决定 |
| supporting_source_ids | 支持该洞察的资料来源 ID |
| evidence_strength | 证据强度（strong / medium / weak） |
| risk_flag | 是否存在争议 |
| confidence_score | 模型自信度 |

3. **contradictions_or_gaps（研究冲突与空白）**

```json
{
  \"contradictions_or_gaps\": [
    {
      \"id\": \"gap_1\",
      \"issue\": \"用户定义粒度不一致\",
      \"description\": \"部分研究以行业角色定义用户，部分以具体任务定义用户，结论存在冲突\",
      \"user_decision\": \"pending\"
    }
  ]
}
```

**用户交互流程**

1. 从资料搜索页点击确认并进入下一步后，跳转至资料整理页
2. 资料整理页调用 research-agent 的 research_synthesis 函数，输出观点洞察（synthesized_insights）以及矛盾空白（contradictions_or_gaps）
3. 页面采用左右结构布局：
   - 左侧面板：显示资料类型统计和审阅指南
   - 右侧面板：显示具体洞察内容和操作区
4. Agent 输出 THOUGHT 以及除 user_decision 之外的所有内容
5. 系统展示所有洞察，默认全部未决策
6. 用户可通过以下方式进行决策：
   - 单个选择：对每条洞察选择必须使用/背景补充/排除
   - 批量选择：勾选多条洞察后批量设置为必须使用/背景补充/排除
   - 一键全选：将所有洞察设置为必须使用
7. 系统实时统计未决策数量，显示还有xxx项未决策
8. 点击未决策提示可直接跳转到第一条未决策资料
9. 用户完成所有决策后，系统更新 user_decision 字段
10. research_synthesis 输出的结果保存在 Supabase 数据库中，形成 **research_pack**
11. 页面底部显示日志框，展示运行步骤
12. 日志框包含日志详情按钮，点击后弹窗显示 research_synthesis 接收到的输入、输出以及 LLM 输出的 THOUGHT 部分内容
13. 用户点击确认并进入下一步后，进入文章结构生成阶段
14. **所有阶段的进度条必须显示当前状态，不得显示为 -**

**用户操作**

对每条洞察，用户可选择：
- 必须使用（must_use）：核心观点，将直接用于文章论证
- 背景补充（background）：辅助信息，可作为背景或补充说明
- 排除（excluded）：不相关或不适用的内容

**确认条件**

- 用户完成所有洞察的决策后，确认并进入下一步按钮启用
- 点击后保存用户决策，调用 structure-agent，进入文章结构生成页面

**资料整理 Payload 格式（research_pack）**

```json
{
  \"project_id\": \"uuid\",
  \"synthesized_insights\": [
    {
      \"id\": \"insight_1\",
      \"category\": \"分类\",
      \"content\": \"洞察内容\",
      \"supporting_source_ids\": [\"source_id_1\"],
      \"citability\": \"direct / paraphrase\",
      \"evidence_strength\": \"strong / medium / weak\",
      \"risk_flag\": false,
      \"confidence_score\": 0.89,
      \"user_decision\": \"confirmed / ignored / pending\"
    }
  ],
  \"contradictions_or_gaps\": [],
  \"created_at\": \"timestamp\"
}
```

#### 阶段 5：文章结构生成

**后端内容筛选**

在用户完成资料整理阶段的决策后，后端需要对 research_pack 的输出进行内容筛选，仅将用户确认采用的内容传递给 structure-agent：

```javascript
const structureAgentInput = {
  writing_brief,
  research_pack: {
    accepted_insights: research_pack.synthesized_insights
      .filter(i => i.user_decision === \"confirmed\"),
    accepted_gaps: research_pack.contradictions_or_gaps
      .filter(g => g.user_decision === \"confirmed\")
  }
};
```

**重要说明**：
- 未被用户采用的 insights 不会传递给 structure-agent
- 但这些内容不会被丢弃，仍保留在 session 中，供后续写作或扩展阶段使用

**输入 JSON 串**

这是上一步 research_pack 输出 → 经过 user decision → 系统整理后，唯一允许传给 structure-agent 的输入形态：

```json
{
  \"topic\": \"AI Agent 项目的商业失败原因分析\",
  \"user_core_thesis\": null,
  \"confirmed_insights\": [
    {
      \"id\": \"insight_1\",
      \"category\": \"AI Agent 商业失败原因\",
      \"content\": \"多数 AI Agent 项目失败并非模型能力不足，而是缺乏清晰的用户任务闭环。\",
      \"source_insight_id\": \"insight_1\",
      \"citation_id\": \"c_1\"
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
| user_core_thesis | 用户强控位（最高优先级） |
| confirmed_insights | 唯一可用信息源 |
| category | 结构聚合提示，不是判断 |
| context_flags | 只提示存在性，防止 AI 补全 |
| citation_id | 引用标识，用于后续可视化引用标记 |

**注意**：
- 没有 supporting_data
- 没有 pending / optional
- 没有 contradictions_or_gaps 的具体内容

**Prompt**

```
你是 CoWrite 的文章级论证架构 Agent（User-Gated）。

你的职责不是写文章，而是：
基于用户已确认的研究洞察，生成一份可编辑、可确认的文章论证结构草案。

────────────────
输入前提（强制）
────────────────
- 你只能使用 user 已确认（confirmed）的洞察
- 任何 pending / optional / ignored 的内容一律不可使用
- 不允许引入新观点、新材料或隐含前提
- 若已确认洞察不足以支撑结构，必须明确指出，而不是补全
- **必须引用 research_pack**

────────────────
输入
────────────────
以下是结构化 JSON 数据，请严格按字段理解：
{{INPUT_JSON}}

────────────────
你的任务
────────────────
1. 基于 confirmed_insights，提炼文章核心论点（一句话）
   - 若 user_core_thesis 已提供，必须完全服从
2. 拆分 3–5 个一级论证块（章节级）
3. 为每个论证块明确论证任务（说明要证明什么，而不是写什么）
4. 说明论证块之间的逻辑关系（递进 / 并列 / 因果 / 对比 等）
5. **每个 block 必须标明 derived_from 和 citation_id**
6. **不允许空 derived_from**

────────────────
结构边界
────────────────
- 不生成正文内容
- 不展开案例、数据或引用
- 不处理研究冲突与空白（除非已被升级为 confirmed_insight）
- 输出必须保持高度可编辑性，便于用户删除或重排

────────────────
输出要求
────────────────
- 仅以 JSON 输出
- 结构生成后必须停在等待用户确认状态
- 不得进入写作阶段
```

**输出 JSON 串（argument_outline）**

```json
{
  \"core_thesis\": \"AI Agent 项目的失败更多源于用户任务闭环缺失，而非模型能力不足。\",
  \"argument_blocks\": [
    {
      \"id\": \"block_1\",
      \"title\": \"用户任务闭环缺失的普遍性\",
      \"description\": \"论证在大量 AI Agent 项目中，未能定义清晰、可执行的用户任务闭环是一种普遍现象。\",
      \"order\": 1,
      \"relation\": \"起始论证块，提出核心问题\",
      \"derived_from\": [\"insight_1\"],
      \"citation_id\": \"c_1\",
      \"user_editable\": true
    },
    {
      \"id\": \"block_2\",
      \"title\": \"任务不清对产品价值转化的影响\",
      \"description\": \"说明用户任务不清如何导致 Agent 能力无法转化为稳定、可感知的产品价值。\",
      \"order\": 2,
      \"relation\": \"递进：从现象到影响\",
      \"derived_from\": [\"insight_1\"],
      \"citation_id\": \"c_1\",
      \"user_editable\": true
    },
    {
      \"id\": \"block_3\",
      \"title\": \"从模型能力迷思回到产品设计问题\",
      \"description\": \"对比模型能力提升与任务定义缺失之间的错位，澄清失败原因的常见误判。\",
      \"order\": 3,
      \"relation\": \"对比：纠正常见解释偏差\",
      \"derived_from\": [\"insight_1\"],
      \"citation_id\": \"c_1\",
      \"user_editable\": true
    }
  ],
  \"structure_relations\": \"文章采用递进式结构，从问题现象出发，分析影响机制，并对常见误解进行澄清。\",
  \"coverage_check\": true,
  \"unused_insights\": [],
  \"logical_pattern\": \"递进\",
  \"estimated_word_distribution\": {
    \"block_1\": 800,
    \"block_2\": 1000,
    \"block_3\": 1200
  },
  \"status\": \"awaiting_user_confirmation\",
  \"allowed_user_actions\": [\"edit_core_thesis\", \"delete_block\", \"reorder_blocks\"]
}
```

**structure-agent 输出存储**

```javascript
session.structure_result = {
  outline: [...],
  section_purpose_map: {...},
  coverage_map: {...}
};

session.current_stage = WritingStage.STRUCTURE;
```

用户可对文章结构进行确认、调整或重新生成

#### 阶段 6：生成草稿

**draft-agent 强制输入**

```json
{
  \"writing_brief\": {...},
  \"argument_outline\": {...},
  \"research_pack\": {...}
}
```

**Prompt 要求**

在 prompt 中明确：若未使用 argument_outline 和 research_pack，不得生成草稿。

**draft-agent 综合功能**

draft-agent 综合以下功能：
- generate_paragraph_reasoning（段落推理生成）
- generate_evidence（证据生成）
- verify_coherence（连贯性验证）
- 生成正文

**可视化引用标记**

当 LLM 使用：

```json
{
  \"citation_id\": \"c_3\"
}
```

草稿里变成：

```
（见资料3）
```

UI 点击后展示：
- 摘要
- 来源
- URL

**草稿 Payload 格式**

```json
{
  \"project_id\": \"uuid\",
  \"draft_blocks\": [
    {
      \"block_id\": \"block_1\",
      \"paragraph_id\": \"p1\",
      \"content\": \"段落内容...\",
      \"derived_from\": [\"insight_id\"],
      \"citations\": [
        {
          \"source_id\": \"source_id_1\",
          \"source_url\": \"链接\",
          \"quote\": \"引用内容\",
          \"citation_type\": \"direct\",
          \"citation_id\": \"c_1\"
        }
      ],
      \"requires_user_input\": false,
      \"coherence_score\": 0.89
    }
  ],
  \"global_coherence_score\": 0.92,
  \"missing_evidence_blocks\": [],
  \"needs_revision\": false,
  \"version\": 1,
  \"created_at\": \"timestamp\"
}
```

用户可对草稿进行审校和修改

#### 阶段 7：内容审校

**review-agent 综合功能**

review-agent 综合现在内容审校的三个 prompt，提供三遍审校流程。

**审校 Payload 格式**

```json
{
  \"project_id\": \"uuid\",
  \"logic_issues\": [
    {
      \"issue_id\": \"logic_1\",
      \"description\": \"逻辑问题描述\",
      \"location\": \"block_1, paragraph_2\",
      \"severity\": \"high / medium / low\"
    }
  ],
  \"citation_issues\": [],
  \"style_issues\": [],
  \"redundancy_score\": 0.12,
  \"suggested_rewrites\": [
    {
      \"rewrite_id\": \"rw_1\",
      \"original\": \"原始内容\",
      \"suggested\": \"建议修改\",
      \"reason\": \"修改理由\"
    }
  ],
  \"created_at\": \"timestamp\"
}
```

用户逐步完成审校并确认

#### 阶段 8：排版导出

- 支持多种格式导出
- 用户可选择导出格式并完成导出

---

## 3. 写作状态管理（WritingState）

### 3.1 WritingState 对象

WritingState 是整个系统的中枢，用于管理写作流程的状态和用户决策。

```typescript
WritingState {
  session_id: string
  project_id: string
  current_stage: 'requirement' | 'retrieval' | 'synthesis' | 'structure' | 'draft' | 'review' | 'export'
  
  locked: {
    core_thesis: boolean
    structure: boolean
  }
  
  user_decisions: {
    retrieval?: RetrievalDecision
    synthesis?: SynthesisDecision
    structure?: StructureDecision
    draft?: DraftDecision
    review?: ReviewDecision
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

#### RetrievalDecision（资料搜索决策）
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

#### DraftDecision（草稿决策）
```typescript
DraftDecision {
  action: 'accept' | 'revise'
  revise_blocks?: string[]
}
```

#### ReviewDecision（审校决策）
```typescript
ReviewDecision {
  accepted_suggestions: string[]
  rejected_suggestions: string[]
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

---

## 4. Agent 调度逻辑

### 4.1 流程控制

新的 Agent 调度逻辑采用状态机式流程控制：

```
Requirement（需求明确）
  ↓
等待用户确认需求文档
  ↓
Retrieval（资料搜索）
  ↓
等待用户 RetrievalDecision 或 跳过
  ↓
Synthesis（资料整理）
  ↓
等待用户 SynthesisDecision
  ↓
Structure（文章结构）
  ↓
等待用户 StructureDecision
  ↓
Draft（生成草稿）
  ↓
等待用户 DraftDecision
  ↓
Review（内容审校）
  ↓
等待 ReviewDecision
  ↓
Export（排版导出）
```

关键规则：
- 任何阶段没有用户决策，不允许进入下一阶段
- 每个阶段的 Agent 只读取 WritingState，不做假设
- 用户决策保存后，才能触发下一阶段 Agent
- 用户可在资料搜索阶段选择跳过，直接进入文章结构生成
- **Research 只做一次**，后续所有阶段复用 research_pack
- **所有 Agent 强制依赖前序产物**

### 4.2 Agent 依赖关系

| Agent | 强制依赖 |
|-------|----------|
| brief-agent | 用户输入 |
| research-agent | writing_brief |
| structure-agent | writing_brief + research_pack |
| draft-agent | writing_brief + argument_outline + research_pack |
| review-agent | draft |

### 4.3 前端状态驱动

前端采用状态机式渲染，核心判断逻辑：

```javascript
if (stage === 'requirement' && !userDecision.requirement) {
  showRequirementEditor()
}

if (stage === 'retrieval' && !userDecision.retrieval) {
  showRetrievalSelection()
}

if (stage === 'synthesis' && !userDecision.synthesis) {
  showSynthesisSelection()
}

if (stage === 'structure' && !locked.structure) {
  showStructureEditor()
}

if (stage === 'draft' && !userDecision.draft) {
  showDraftEditor()
}

if (stage === 'review' && !userDecision.review) {
  showReviewEditor()
}
```

每个 Agent 结果页必须包含三块 UI：
1. AI 生成结果
2. 用户操作区
3. AI 引导词（Guidance Agent）

引导词是独立接口返回，不是写死文案。

### 4.4 前端操作类型

前端只做 3 类操作：
1. 选择：勾选研究洞察
2. 确认：接受核心论点
3. 排序/删除：拖拽论证块

禁止操作：
- 不让用户改长文本
- 不让用户重写

---

## 5. 统一 Runtime 架构

### 5.1 目录结构

```
/llm
  ├── runtime/
  │     ├── callLLM.ts
  │     ├── normalize.ts
  │     ├── parseEnvelope.ts
  │     ├── validateSchema.ts
  │     ├── repairJSON.ts          ← 新增 JSON 修复模块
  │     └── LLMRuntime.ts          ← 核心统一入口
  │
  ├── agents/
  │     ├── briefAgent.ts
  │     ├── researchAgent.ts
  │     ├── structureAgent.ts
  │     ├── draftAgent.ts
  │     ├── reviewAgent.ts
  │     └── repairAgent.ts         ← 新增 JSON 修复 Agent
  │
  ├── schemas/
  │     ├── briefSchema.ts
  │     ├── researchSchema.ts
  │     ├── structureSchema.ts
  │     ├── draftSchema.ts
  │     └── reviewSchema.ts
  │
  └── envelopes/
        ├── envelopeTypes.ts
        └── envelopeParser.ts
```

### 5.2 核心思想

所有 agent 不再直接调用模型。

统一改为：

```typescript
await runLLMAgent({
  agentName: \"briefAgent\",
  prompt,
  schema,
  model: \"gemini-2.5-pro\",
  temperature: 0.4
})
```

### 5.3 统一 Runtime 核心代码结构

#### 统一入口（LLMRuntime.ts）

```typescript
export async function runLLMAgent(config: {
  agentName: string
  prompt: string
  schema: ZodSchema
  model?: string
  temperature?: number
}) {
  const raw = await callLLM(config)

  const normalized = normalizeLLMOutput(raw)

  const envelope = parseEnvelope(normalized)

  let parsedPayload
  try {
    parsedPayload = parsePayload(envelope.payload)
  } catch (e) {
    // JSON 解析失败，调用修复 Agent
    const repaired = await repairJSON(envelope.payload)
    parsedPayload = parsePayload(repaired)
  }

  const validated = validateSchema(parsedPayload, config.schema)

  return {
    agent: config.agentName,
    meta: envelope.meta,
    data: validated
  }
}
```

Agent 只关心：
- prompt
- schema

其他都不用管。

#### callLLM.ts

只负责模型通信。

```typescript
export async function callLLM({
  prompt,
  model = \"gemini-2.5-pro\",
  temperature = 0.3
}) {
  const res = await openai.chat.completions.create({
    model,
    temperature,
    messages: [
      { role: \"system\", content: prompt }
    ]
  })

  return res.choices[0].message.content
}
```

没有任何解析逻辑。

#### normalize.ts

统一处理：
- 中文引号 → 英文
- 多余 markdown
- BOM
- 奇怪空白字符

```typescript
export function normalizeLLMOutput(raw: string) {
  return raw
    .replace(/[