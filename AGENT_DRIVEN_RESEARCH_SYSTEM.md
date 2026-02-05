# Agent 驱动的学术资料查询系统

## 系统架构

新的学术资料查询系统使用两个 LLM Agent 替代了原有的多步骤搜索流程：

```
旧系统流程（6步）:
用户查询 → 意图拆解 → 学术转写 → 网页转写 → 并行搜索 → 翻译提取 → 结果排序 → 综合摘要

新系统流程（2步）:
用户需求文档 → Research Retrieval Agent → Research Synthesis Agent → 写作素材包
```

---

## Agent 1: Research Retrieval Agent（资料检索 Agent）

### 职责
负责"找得准 + 找得新 + 找得全"，在 5 个数据源中检索最贴合主题、最具时效性、最具信息密度的研究与事实材料。

### 输入
结构化 JSON 需求文档，包含：
- 主题
- 关键要点
- 核心观点
- 目标读者
- 写作风格
- 预期长度

### 数据源（5个）
1. **Google Scholar** - 学术研究、方法论、框架、实证研究
   - 语言：英文为主
   - 年份：2020年至今
   - 返回数量：最多10条
   - 优先级：与关键要点高度相关、引用次数较高、包含方法/模型/实证/失败案例

2. **TheNews** - 新闻 & 行业动态
   - 强时效性（最近1-2年优先）
   - 返回数量：最多10条

3. **Smart Search** (Bing Web Search) - 博客、白皮书、行业报告、实践总结
   - 市场/语言：zh-CN优先，其次英文
   - freshness参数：开启（优先近12-24个月）
   - 返回数量：最多10条
   - 自动清理特殊字符，确保JSON可解析

4. **用户参考文章库** - 用户显式提供或历史沉淀的参考资料
   - 判断与当前需求文档的相关度
   - 标记「高度相关 / 可补充 / 边缘相关」

5. **用户个人素材库** - 用户过往观点、笔记、方法论、内部总结
   - 只做检索与匹配
   - 不篡改、不重写原始内容

### 检索策略
1. **理解需求** - 从JSON中提取核心问题、关键判断维度、隐含研究目标
2. **反向生成搜索Query** - 将中文需求转写为英文学术关键词和中英文混合行业关键词
3. **多源并行搜索** - 三个外部搜索源 + 两个内部库同时进行
4. **结果去重 & 相关度过滤** - 删除明显跑题、纯营销内容、无实质信息的新闻稿

### 输出格式
```json
{
  "search_summary": {
    "interpreted_topic": "解读的主题",
    "key_dimensions": ["关键维度1", "关键维度2"]
  },
  "search_queries": {
    "academic_keywords": ["学术关键词1", "学术关键词2"],
    "web_queries": ["网页查询1", "网页查询2"]
  },
  "academic_sources": [
    {
      "title": "论文标题",
      "authors": "作者",
      "year": 2023,
      "citation_count": 128,
      "abstract": "摘要",
      "url": "链接",
      "core_relevance": "高度相关 / 中度相关"
    }
  ],
  "news_sources": [
    {
      "title": "新闻标题",
      "source": "来源",
      "published_at": "发布时间",
      "snippet": "摘要",
      "url": "链接",
      "why_relevant": "相关性说明"
    }
  ],
  "web_sources": [
    {
      "title": "网页标题",
      "site_name": "网站名",
      "snippet": "摘要",
      "url": "链接",
      "last_crawled_at": "最后爬取时间",
      "why_relevant": "相关性说明"
    }
  ],
  "user_library_sources": [
    {
      "id": "UUID",
      "title": "标题",
      "content": "内容",
      "url": "链接",
      "relevance_level": "高 / 中 / 低"
    }
  ],
  "personal_sources": [
    {
      "id": "UUID",
      "title": "标题",
      "content": "内容",
      "relevance_level": "高 / 中 / 低"
    }
  ]
}
```

### 行为约束
- ❌ 不输出自然语言总结
- ❌ 不进行中文翻译或观点提炼（这是下一个Agent的工作）
- ✅ 只做搜索、筛选、结构化返回

---

## Agent 2: Research Synthesis Agent（资料整理 Agent）

### 职责
负责"提炼 → 中文化 → 可写作"，将Research Retrieval Agent输出的多源资料，转化为中文、结构化、可直接用于写作的研究素材包。

### 输入
- Research Retrieval Agent的检索结果
- 需求文档

### 核心任务

#### 1️⃣ 中文化（非直译）
- 所有英文资料：用专业但非学术腔的中文表达
- 避免生硬翻译
- 面向「商业 + 产品 + 技术复合读者」

#### 2️⃣ 信息提炼（高密度）
对每一条资料，提取以下要素：
- 核心结论 / 观点
- 关键数据 / 实证结果
- 使用的方法 / 分析框架
- 与需求文档中「关键要点」的对应关系

#### 3️⃣ 结构化归类
主动帮写作者整理思路，推荐分类维度：
- 商业化失败模式
- 用户识别方法
- ROI / 价值评估方式
- 实践案例 vs 学术结论的差异

#### 4️⃣ 标注可引用性
对每一条观点，标注：
- 是否适合直接引用
- 是否更适合作为背景或论据
- 是否存在争议或样本局限

### 输出格式
```json
{
  "synthesized_insights": [
    {
      "theme": "主题分类",
      "insights": [
        {
          "core_point": "核心观点",
          "evidence": "证据",
          "source_type": "academic / news / web / user",
          "source_title": "来源标题",
          "source_url": "来源链接",
          "usable_as": "核心论点 / 案例 / 背景",
          "notes": "备注（如样本局限、争议等）"
        }
      ]
    }
  ],
  "key_data_points": [
    {
      "data": "数据点",
      "source": "来源",
      "source_url": "来源链接",
      "year": 2024,
      "reliability": "高 / 中 / 低"
    }
  ],
  "contradictions_or_gaps": [
    "学术研究与行业实践在ROI衡量方式上存在明显分歧"
  ],
  "ready_to_cite": "可直接用于文章结构生成的综合版本（整合需求文档和研究资料）"
}
```

### 行为约束
- ❌ 不输出完整文章
- ❌ 不引入未在资料中出现的新观点
- ✅ 所有内容服务于后续写作阶段

---

## 完整工作流程示例

### 用户输入（需求文档）
```json
{
  "主题": "AI Agent应用的成功商业化和用户获取",
  "关键要点": [
    "理解AI Agent：定义其独特能力与商业潜力",
    "商业化和用户获取的核心挑战",
    "识别目标用户的方法论"
  ],
  "核心观点": [
    "AI Agent的商业化成功在于深入理解其独特价值",
    "用户获取需要精准的用户画像和创新的商业模式设计"
  ],
  "目标读者": "产品经理、创业者、技术决策者",
  "写作风格": "专业、实用、有深度",
  "预期长度": "3000-5000字"
}
```

### 第一步：Research Retrieval Agent 执行

#### LLM 生成搜索计划
```json
{
  "search_summary": {
    "interpreted_topic": "AI Agent商业化路径与用户识别方法",
    "key_dimensions": [
      "AI Agent核心能力定义",
      "商业化失败案例分析",
      "用户画像构建方法",
      "ROI评估框架"
    ]
  },
  "search_queries": {
    "academic_keywords": [
      "AI agent commercialization",
      "autonomous agent business model",
      "user acquisition AI products"
    ],
    "web_queries": [
      "AI agent startup failures 2024",
      "successful AI agent products user identification"
    ]
  }
}
```

#### 并行搜索 5 个数据源
- Google Scholar: 10篇学术论文
- TheNews: 10条新闻
- Smart Search: 10条网页
- 用户参考文章库: 3篇
- 用户个人素材库: 5条

**总计**: 38条原始资料

### 第二步：Research Synthesis Agent 执行

#### 中文化 + 提炼 + 归类

```json
{
  "synthesized_insights": [
    {
      "theme": "AI Agent商业化失败模式",
      "insights": [
        {
          "core_point": "过度依赖技术能力展示，忽视用户实际需求场景",
          "evidence": "2023年倒闭的15家AI Agent创业公司中，80%未进行充分的用户调研",
          "source_type": "news",
          "source_title": "Why AI Agent Startups Failed in 2023",
          "source_url": "https://...",
          "usable_as": "案例",
          "notes": "样本主要来自欧美创业公司，中国市场可能有差异"
        }
      ]
    },
    {
      "theme": "用户识别方法论",
      "insights": [
        {
          "core_point": "采用Jobs-to-be-Done框架识别AI Agent的核心用户场景",
          "evidence": "哈佛商学院研究表明，JTBD框架可提升30%的产品市场匹配度",
          "source_type": "academic",
          "source_title": "User-Centered AI Agent Design",
          "source_url": "https://...",
          "usable_as": "核心论点",
          "notes": "学术研究，实践应用需结合具体行业"
        }
      ]
    }
  ],
  "key_data_points": [
    {
      "data": "AI Agent市场规模预计2025年达到$200B",
      "source": "Gartner 2024 Report",
      "source_url": "https://...",
      "year": 2024,
      "reliability": "高"
    }
  ],
  "contradictions_or_gaps": [
    "学术研究强调技术创新，但行业实践更关注商业闭环",
    "缺乏针对中国市场的AI Agent用户行为研究"
  ],
  "ready_to_cite": "AI Agent的商业化成功关键在于平衡技术能力与用户需求。研究表明，失败的AI Agent产品往往过度展示技术，而忽视用户实际场景（来源：2023年AI创业失败案例分析）。成功的用户识别方法包括：1）采用Jobs-to-be-Done框架明确核心场景（哈佛商学院研究）；2）构建精准用户画像，关注用户痛点而非技术亮点；3）建立可持续的商业模式，确保ROI可衡量。市场数据显示，AI Agent市场规模预计2025年达到$200B（Gartner 2024），但商业化路径仍需探索。"
}
```

---

## 与旧系统的对比

| 维度 | 旧系统 | 新系统（Agent驱动） |
|------|--------|-------------------|
| **步骤数** | 6步（意图拆解→学术转写→网页转写→搜索→翻译→排序→摘要） | 2步（检索→整理） |
| **Prompt数量** | 6个独立Prompt | 2个Agent Prompt |
| **中文化时机** | 搜索后逐条翻译 | 整理阶段统一中文化 |
| **数据源** | 3个外部源 | 5个源（3外部+2内部） |
| **结果格式** | 分散的论文列表 | 结构化写作素材包 |
| **可引用性** | 需人工判断 | Agent自动标注 |
| **与需求文档关联** | 弱关联 | 强关联（每条资料标注与需求的对应关系） |

---

## API 调用示例

### 前端调用
```typescript
import { agentDrivenResearchWorkflow } from '@/db/api';

// 构建需求文档
const requirementsDoc = {
  主题: "AI Agent应用的成功商业化和用户获取",
  关键要点: ["理解AI Agent", "商业化挑战", "用户识别方法"],
  核心观点: ["深入理解独特价值", "精准用户画像"],
  目标读者: "产品经理、创业者",
  写作风格: "专业、实用",
  预期长度: "3000-5000字"
};

// 执行Agent工作流
const { retrievalResults, synthesisResults } = await agentDrivenResearchWorkflow(
  requirementsDoc,
  projectId,
  userId
);

// retrievalResults: 原始检索结果（5个数据源）
// synthesisResults: 中文化的写作素材包
```

### Edge Function 调用
```typescript
// 1. Research Retrieval Agent
const { data: retrievalResults } = await supabase.functions.invoke(
  'research-retrieval-agent',
  {
    body: { requirementsDoc, projectId, userId }
  }
);

// 2. Research Synthesis Agent
const { data: synthesisResults } = await supabase.functions.invoke(
  'research-synthesis-agent',
  {
    body: { retrievalResults, requirementsDoc }
  }
);
```

---

## 数据库存储

### knowledge_base 表
检索到的所有资料都保存到知识库：

```sql
INSERT INTO knowledge_base (
  project_id,
  title,
  content,
  source,  -- 'Google Scholar' / 'TheNews' / 'Smart Search' / '参考文章库' / '个人素材库'
  source_url,
  collected_at,
  selected,
  keywords
) VALUES (...);
```

### projects 表
综合摘要保存到项目的 `writing_summary` 字段：

```sql
UPDATE projects
SET writing_summary = synthesisResults
WHERE id = projectId;
```

---

## 优势

1. **简化流程** - 从6步减少到2步，降低维护成本
2. **智能理解** - LLM Agent能更好地理解需求文档的隐含意图
3. **全面检索** - 覆盖5个数据源，包括用户个人资料
4. **中文优化** - 统一中文化，避免生硬翻译
5. **写作导向** - 输出直接服务于写作，标注可引用性
6. **可追溯** - 每条观点都有明确来源和可靠性标注

---

## 注意事项

1. **LLM Token消耗** - 两个Agent都需要调用LLM，注意控制输入长度
2. **并行搜索** - 5个数据源并行搜索，注意错误处理
3. **JSON解析** - Agent输出需要从markdown代码块中提取JSON
4. **超时处理** - 整个流程可能需要30-60秒，需要合理设置超时时间
5. **错误恢复** - 单个数据源失败不应影响整体流程

---

## 未来优化方向

1. **增量更新** - 支持基于已有资料的增量检索
2. **相关性评分** - Agent自动评估每条资料的相关性得分
3. **多轮对话** - 支持用户与Agent对话，细化检索需求
4. **缓存机制** - 相似需求文档复用检索结果
5. **质量评估** - 自动评估综合摘要的质量和完整性
