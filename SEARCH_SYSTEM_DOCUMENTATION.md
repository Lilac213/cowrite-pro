# 学术资料查询系统文档

## 搜索引擎和数据源

### 1. Google Scholar（学术论文搜索）
- **用途**: 搜索学术论文、引用文献
- **API**: Google Scholar via SerpApi
- **特点**: 
  - 覆盖全球学术文献
  - 包含引用次数
  - 支持年份筛选（2020年至今）
  - 限制返回前10条结果
- **返回字段**: 标题、作者、摘要、引用次数、发布年份、URL

### 2. TheNews（新闻资讯搜索）
- **用途**: 搜索最新新闻和行业动态
- **特点**:
  - 实时新闻内容
  - 行业动态追踪
  - 限制返回10条结果
- **返回字段**: 标题、内容摘要、来源、发布时间、URL

### 3. Smart Search（网页搜索）
- **用途**: 综合网页搜索，覆盖广泛的互联网内容
- **API**: Bing Web Search
- **特点**:
  - 支持时效性筛选（freshness参数）
  - 支持市场/语言设置（默认zh-CN）
  - 限制返回10条结果
  - 自动清理特殊字符，防止JSON解析错误
- **返回字段**: 标题、网站名称、内容片段、URL、最后爬取时间

## 搜索工作流程

### 阶段1: 搜索意图拆解（Search Intent Decomposer）

**Prompt**:
```
你是一名研究型搜索专家。

请分析以下【中文需求】，判断其中涉及的研究意图，
并拆解为【学术搜索意图】与【实时网页搜索意图】。

要求：
1. 学术意图：偏向理论、方法、研究共识
2. 网页意图：偏向行业动态、产品、政策、实践
3. 两类都可能为空或同时存在
4. 不要解释

输出格式（JSON）：
{
  "academic_intent": "",
  "web_intent": ""
}
```

**输入**: 用户的中文搜索需求
**输出**: 
- `academic_intent`: 学术搜索意图
- `web_intent`: 实时网页搜索意图

---

### 阶段2: 学术搜索转写（Academic Search Rewriting V2）

**Prompt**:
```
你是一名学术搜索专家。

请将以下【学术搜索意图】转写为
【用于英文学术数据库（如 OpenAlex）检索的关键词】。

要求：
1. 使用学术界常见术语
2. 覆盖研究对象 + 方法
3. 关键词 3–6 个
4. 英文输出
5. 不要解释

输出格式（JSON）：
{
  "main_keywords": [],
  "related_keywords": []
}
```

**输入**: 学术搜索意图（中文）
**输出**: 
- `main_keywords`: 主要学术关键词（英文）
- `related_keywords`: 相关学术关键词（英文）

**使用场景**: 用于 Google Scholar 搜索

---

### 阶段3: 实时网页搜索转写（Web Search Rewriting）

**Prompt**:
```
你是一名实时信息检索专家。

请将以下【网页搜索意图】转写为
【适合实时网页搜索引擎（如 Tavily）使用的英文查询语句】。

要求：
1. 偏向自然语言，而非学术术语
2. 可包含行业、产品、应用、趋势等词
3. 不超过 2 条搜索 query
4. 英文输出
5. 不要解释

输出格式（JSON）：
{
  "queries": []
}
```

**输入**: 网页搜索意图（中文）
**输出**: 
- `queries`: 网页搜索查询语句数组（英文，最多2条）

**使用场景**: 用于 TheNews 和 Smart Search

---

### 阶段4: 翻译和数据提取（Translate & Extract Content）

**功能**: 
- 检测英文内容（英文字符占比>50%）
- 翻译标题和内容为中文
- 提取关键数据点（data_points）
- 提取核心观点（viewpoints）

**返回结构**:
```json
{
  "translated_title": "翻译后的标题",
  "summary": "翻译后的摘要",
  "data_points": [
    {
      "original": "原始数据",
      "translated": "翻译后的数据",
      "context": "数据上下文"
    }
  ],
  "viewpoints": [
    {
      "original": "原始观点",
      "translated": "翻译后的观点",
      "supporting_evidence": "支持证据"
    }
  ]
}
```

---

### 阶段5: 结果排序和筛选

**排序算法**:
```javascript
// 相关性得分
- 标题匹配: +50分
- 内容匹配: +30分

// 时效性得分
- 最近30天: +20分
- 最近3个月: +15分
- 最近6个月: +10分
- 最近1年: +5分

// 最终筛选
- 按总分排序
- 取前10条结果
```

---

### 阶段6: 综合摘要生成（Writing Summary）

**Prompt**:
```
你是 CoWrite 的"研究摘要生成模块"。

基于已筛选的高质量来源和需求文档，请完成以下任务：

1️⃣ 用 **中立、专业、可引用的语言** 总结核心观点  
2️⃣ 明确区分：
   - 学术共识
   - 行业实践 / 现实应用
3️⃣ **重点关注需求文档中的主题、核心观点和关键要点**
4️⃣ 罗列出与需求文档相关的数据和观点，对需求文档进行补充和论证
5️⃣ 避免编造结论，不确定的地方需标注
6️⃣ 生成一份后续生成文章结构时能直接引用的版本

输出结构必须包含：
{
  "requirement_alignment": {
    "topic": "需求文档主题",
    "core_viewpoints": ["需求文档核心观点"],
    "key_points": ["需求文档关键要点"]
  },
  "background_summary": "背景总结（结合需求文档）",
  "supporting_data": [
    {
      "data_point": "具体数据",
      "source": "来源",
      "relevance_to_requirement": "与需求文档的关联性"
    }
  ],
  "supporting_viewpoints": [
    {
      "viewpoint": "观点",
      "evidence": "证据",
      "source": "来源",
      "supports_requirement": "支持需求文档的哪个部分"
    }
  ],
  "academic_insights": [
    {
      "point": "学术观点",
      "evidence_source": "academic",
      "relevance": "与需求的相关性"
    }
  ],
  "industry_insights": [
    {
      "point": "行业实践",
      "evidence_source": "industry",
      "relevance": "与需求的相关性"
    }
  ],
  "open_questions_or_debates": ["待探讨的问题"],
  "suggested_writing_angles": ["建议的写作角度（基于需求文档）"],
  "ready_to_cite": "可直接引用的综合版本（整合需求文档和研究资料）"
}
```

**输入**: 
- 已选择的知识库条目
- 需求文档（requirements）

**输出**: 
- 结构化的写作摘要
- **ready_to_cite**: 可直接用于文章结构生成的综合版本

---

## 完整搜索流程示例

### 用户输入
```
人工智能在医学影像中的应用
```

### 流程执行

1. **意图拆解**
   - academic_intent: "人工智能在医学影像诊断中的算法和准确性研究"
   - web_intent: "AI医学影像产品、临床应用案例、最新进展"

2. **学术搜索转写**
   - main_keywords: ["artificial intelligence", "medical imaging", "diagnosis"]
   - related_keywords: ["deep learning", "radiology", "computer vision"]

3. **网页搜索转写**
   - queries: ["AI medical imaging applications 2024", "clinical AI radiology products"]

4. **并行搜索**
   - Google Scholar: 搜索学术关键词 → 返回10篇论文
   - TheNews: 搜索第一个query → 返回10条新闻
   - Smart Search: 搜索第一个query → 返回10条网页

5. **个人资源搜索**
   - 搜索个人素材库（materials表）
   - 搜索参考文章库（reference_articles表）

6. **结果处理**
   - 翻译英文内容
   - 提取数据和观点
   - 按相关性和时效性排序
   - 每个来源取前10条

7. **保存到知识库**
   - 标记来源（个人素材库、参考文章库、Google Scholar、Web Search等）
   - 保存翻译后的内容
   - 包含提取的数据和观点

8. **生成综合摘要**
   - 结合需求文档
   - 整合所有来源的数据和观点
   - 生成可引用版本（ready_to_cite）

---

## 文章结构生成

### Prompt
```
你是写作系统中的「文章级论证架构模块」。

请基于以下输入，构建文章的整体论证结构，而不是生成正文内容。

【输入】
- 写作目标 / 主题：${topic}
- 目标读者：${targetAudience}
- 研究摘要（可引用版本）：${writingSummary.ready_to_cite}
- 支持数据：${writingSummary.supporting_data}
- 支持观点：${writingSummary.supporting_viewpoints}

【你的任务】
1. 提炼文章的「核心论点」（一句话）
2. 拆分 3–5 个一级论证块（章节级）
3. 说明每个论证块的作用（为什么需要这一块）
4. 标注论证块之间的关系（并列 / 递进 / 因果 / 对比）

【输出格式】
{
  "core_thesis": "核心论点",
  "argument_blocks": [
    {
      "id": "block_1",
      "title": "论证块标题",
      "description": "该论证块的作用",
      "order": 1,
      "relation": "与前一块的关系"
    }
  ],
  "structure_relations": "结构关系说明"
}

【约束】
- 不生成具体段落
- 不引用案例、数据或研究
- 输出应稳定、抽象、可编辑
```

**关键改进**: 现在使用 `writingSummary.ready_to_cite` 作为输入，确保文章结构基于综合的研究摘要和数据观点。

---

## 数据库表结构

### knowledge_base（知识库）
```sql
- id: UUID
- project_id: UUID (关联项目)
- title: TEXT (标题)
- content: TEXT (内容)
- source: TEXT (来源：个人素材库、参考文章库、Google Scholar、Web Search等)
- source_url: TEXT (原文链接)
- published_at: TIMESTAMP (发布时间)
- collected_at: TIMESTAMP (收集时间)
- selected: BOOLEAN (是否选中用于综合)
- keywords: TEXT[] (关键词)
```

### projects（项目）
```sql
- id: UUID
- user_id: UUID
- title: TEXT
- status: TEXT
- article_argument_structure: JSONB (文章论证结构)
- writing_summary: JSONB (写作摘要，包含ready_to_cite)
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

---

## 优化特性

### 1. Top 10 结果筛选
- 每个搜索源限制返回10条结果
- 按相关性和时效性综合评分
- 优先翻译和处理高分结果

### 2. 智能翻译
- 自动检测英文内容
- 提取关键数据点和观点
- 保留原文引用信息

### 3. 来源标记
- 清晰标识每条信息的来源
- 支持编辑和删除
- 可收藏到参考文章库

### 4. 可引用版本
- 综合摘要包含ready_to_cite字段
- 直接用于文章结构生成
- 整合需求文档和研究资料

---

## 错误处理

### JSON解析错误
- 自动清理特殊字符（控制字符、反斜杠等）
- 尝试从markdown代码块提取JSON
- 提供友好的错误提示

### API失败处理
- 单个搜索源失败不影响其他源
- 使用Promise.all并捕获错误
- 返回部分结果而非完全失败

### 翻译失败处理
- 记录失败数量
- 保留原文内容
- 继续处理其他结果
