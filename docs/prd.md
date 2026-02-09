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
创建项目 → 明确需求 → 资料查询 → 资料整理 → 文章结构 → 段落结构 → 个人素材 → 文章生成 → 内容审校 → 排版导出 → 终版输出

### 2.2 详细阶段说明

#### 阶段 0：注册/登录
- 用户完成注册或登录
- 注册时可填写邀请码，邀请码带有对应点数
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
- 需求文档在后续阶段起到引领作用，资料查询和文章结构生成应围绕需求文档展开
- 用户必须确认需求后才能进入下一步
- 重新点击生成需求文档后，确认按钮需重置为待确认状态
- **PC端**：需求文档模块右侧增加缩进/展开按钮，支持将需求文档隐藏或展开
- **移动端**：无需缩进/展开按钮
- **跳转至资料查询页时**：需求文档不再显示在页面右侧，改为在进度条右侧显示需求文档图标按钮，点击后在弹窗中显示需求文档内容

#### 阶段 3：资料查询（Research Retrieval Agent）

**核心流程：Research Retrieval Agent**

资料查询阶段采用 Research Retrieval Agent 负责多源检索、全文抓取与结构化返回。

**Research Retrieval Agent（资料搜索与全文抓取 Agent）**

角色定义：
- 负责根据用户提供的结构化 JSON 需求文档，在多个数据源中检索最贴合主题、最具时效性、最具信息密度的研究与事实材料
- 核心职责是获取可用于写作的完整、可引用内容，而不是摘要卡片
- 只做搜索、筛选、全文抓取、结构化返回，不做观点发挥、不做写作、不做总结结论

输入：
- 接收 JSON 格式的需求文档，字段包括但不限于：主题、关键要点、核心观点、目标读者、写作风格、预期长度
- 该 JSON 每次都会变化，字段内容是判断相关性的最高优先级信号

可用数据源（必须全部考虑）：

1. Google Scholar（via SerpApi）
   - 用途：学术研究、方法论、框架、实证研究
   - 检索要求：
     - 语言：英文为主
     - 年份：2020 年至今
     - 返回数量：最多 10 条
   - 优先级排序规则：
     - 与关键要点/核心观点高度相关
     - 引用次数较高
     - 明确包含方法、模型、实证或失败案例
   - 返回字段：title、authors、abstract、citation_count、publication_year、url
   - 全文抓取规则：
     - Scholar 默认只有摘要
     - 若 URL 可访问全文（PDF / HTML），必须尝试获取
     - 若无法获取全文，明确标注：abstract_only = true

2. TheNews（新闻 & 行业动态）
   - 用途：最新趋势、商业实践、失败案例、公司动向
   - 检索要求：
     - 强时效性（最近 1-2 年优先）
     - 返回数量：最多 10 条
   - 初始返回字段：title、summary、source、published_at、url
   - 强制规则：
     - TheNews 返回的内容永远不是最终内容
     - 必须读取 URL、抓取新闻正文、提取主要段落
     - 若正文抓取失败，必须标注原因（付费墙 / 403 / 空页面）

3. Smart Search（Bing Web Search）
   - 用途：博客、白皮书、行业报告、实践总结
   - 检索要求：
     - 市场/语言：zh-CN 优先，其次英文
     - freshness 参数：开启（优先近 12-24 个月）
     - 返回数量：最多 10 条
     - 自动清理特殊字符，确保 JSON 可解析
   - 初始返回字段：title、site_name、snippet、url、last_crawled_at
   - 强制规则：
     - snippet 仅用于判断是否值得点开
     - 必须访问 URL，获取正文内容
     - 禁止直接把 snippet 当作资料使用

4. 用户参考文章库（User Reference Library）
   - 用途：用户显式提供或历史沉淀的参考资料
   - 处理方式：
     - 直接视为高可信完整资料
     - 不需要二次搜索
     - 需要结构化拆分（核心观点 / 可引用段落）
   - 要求：
     - 判断与当前需求文档的相关度
     - 标记高度相关/可补充/边缘相关

5. 用户个人素材库（Personal Knowledge Base）
   - 用途：用户过往观点、笔记、方法论、内部总结
   - 处理方式：
     - 只做检索与匹配
     - 不篡改、不重写原始内容
     - 不可当作事实来源，需标注为 personal_material

工作流程（必须严格遵守）：

Step 1：多源检索
- 针对用户需求，分别从 Scholar、TheNews、Smart Search、用户资料库各取 Top N（≤10）

Step 2：内容补全（关键步骤）
- 对每一条非用户本地资料：
  - IF 内容仅包含 title / snippet / abstract:
    - 访问 URL
    - 抓取正文
    - 提取 3-8 个核心段落
  - ELSE:
    - 保留原文

Step 3：内容质量判断
- 若正文长度 < 300 字：标记为 insufficient_content
- 若全文不可访问：标记为 unavailable_fulltext
- 严禁 AI 自行补写不存在的内容

Step 4：结果去重与相关度过滤
- 删除明显跑题、纯营销内容、无实质信息的新闻稿

Research Retrieval Agent 输出格式（严格遵守）：
```json
{
  \"search_summary\": {
    \"interpreted_topic\": \"...\",
    \"key_dimensions\": [\"...\", \"...\"]
  },
  \"academic_queries\": [\"...\", \"...\"],
  \"news_queries\": [\"...\", \"...\"],
  \"web_queries\": [\"...\", \"...\"],
  \"user_library_queries\": [\"...\", \"...\"],
  \"sources\": [
    {
      \"source_type\": \"SmartSearch | TheNews | GoogleScholar | UserLibrary | PersonalMaterial\",
      \"title\": \"...\",
      \"authors\": \"...\",
      \"year\": 2024,
      \"url\": \"...\",
      \"content_status\": \"full_text | abstract_only | insufficient_content | unavailable_fulltext\",
      \"extracted_content\": [
        \"段落1\",
        \"段落2\",
        \"段落3\"
      ],
      \"notes\": \"是否存在付费墙 / 转载 / 摘要限制\",
      \"core_relevance\": \"高度相关 / 中度相关\"
    }
  ],
  \"去重后数量\": {
    \"academic\": 128,
    \"news\": 46,
    \"web\": 92,
    \"user_library\": 15,
    \"personal_material\": 8
  }
}
```

约束：
- 不允许输出自然语言总结
- 不允许中文翻译或观点提炼（这是下一个阶段的工作）
- 不允许基于标题 / snippet / abstract 推断全文观点
- 不允许常识补全

**资料查询页面设计**

页面整体结构：
```
ResearchWorkspacePage
├─ ResearchHeader（研究概览）
├─ MainArea
│  ├─ SearchPlanPanel（左｜搜索计划）
│  └─ SearchResultPanel（右｜搜索结果）
│      ├─ ResultFilterBar
│      ├─ BatchActionBar（选择模式显示）
│      ├─ ResultSections
│      │   ├─ AcademicSection（分区分页）
│      │   ├─ NewsSection（分区分页）
│      │   ├─ WebSection（分区分页）
│      │   ├─ UserLibrarySection（分区分页）
│      │   └─ PersonalMaterialSection（分区分页）
├─ BottomFixedBar（底部固定操作栏）
│   ├─ 资料整理按钮
│   └─ 进入下一步按钮
└─ ResearchProcessDrawer（流程日志，固定悬浮在页面底部）
```

**页面布局说明**

**顶部状态栏**
- 保持原有设计不变

**资料查询模块**
- 标题栏：
  - 左侧：资料查询标题
  - 右侧：上次搜索时间（格式：YYYY/MM/DD HH:MM）
  - 右侧：刷新按钮，支持重新搜索（点击后重新调用 Research Retrieval Agent 和 Research Synthesis Agent）

**左侧：搜索计划面板（SearchPlanPanel）**

内容来源：
- 从 Research Retrieval Agent 输出的 JSON 中解析以下字段：
  - search_summary.interpreted_topic（研究主题）
  - search_summary.key_dimensions（关键维度）
  - academic_queries（学术调研查询内容）
  - news_queries（行业动态查询内容）
  - web_queries（网络搜索查询内容）
  - user_library_queries（用户资料库查询内容）

## 3. 管理员功能

### 3.1 用户管理

#### 3.1.1 邀请码生成功能
- 管理员在用户管理页面可生成随机8位邀请码
- 生成邀请码时可设置邀请码对应的点数
- 邀请码生成后可分享给新用户注册使用

#### 3.1.2 用户权限管理
- 管理员账户拥有无限点数
- 管理员可为每个用户配置点数
- 系统记录每个用户的：
  - AI降重工具已使用次数
  - 已创建项目数量
- 当用户点数不足时，系统显示提示：点数不够需要购买点数

## 4. 用户功能

### 4.1 用户信息显示

#### 4.1.1 使用情况
- 可用点数：显示用户当前可用点数余额
- 项目配额：单行显示已创建项目数量和AI降重已使用次数

### 4.2 点数购买

#### 4.2.1 购买入口
- 在设置页面的用户信息模块中，新增点数购买功能
- 点击后显示点数套餐选择弹窗

#### 4.2.2 点数套餐
点数套餐及价格如下：
- 体验包：16 点，¥9.9
- 推荐包 ⭐：66 点，¥29.9
- 进阶包：166 点，¥79.9
- 专业包：366 点，¥149.9

#### 4.2.3 购买流程
- 用户在弹窗中选择套餐后点击购买按钮
- 跳转到 Stripe Payments 支付页面
- 完成支付后，点数自动充值到用户账户
- 用户可使用点数兑换 AI降重工具使用次数或创建项目权限

## 5. 参考文件

1. 上传图片：image.png
2. 上传图片：image-2.png