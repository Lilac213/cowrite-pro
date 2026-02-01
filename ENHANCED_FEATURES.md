# CoWrite 增强功能说明

## 新增功能概览

本次更新为 CoWrite 添加了三大核心增强功能：

1. **AI 辅助模板生成**
2. **增强型个人素材库**
3. **智能参考文章库**

---

## 1. 模板管理增强

### 功能特点

#### AI 辅助生成模板
- 用户使用自然语言描述格式要求
- AI 自动解析为结构化排版规则
- 支持预览和微调
- 模板仅在终稿输出时生效

#### 使用流程

**Step 1: 输入自然语言描述**
```
本科毕业论文，理工科
封面包含：学校、学院、姓名、学号
正文小四宋体，1.5 倍行距
一级标题三号黑体居中
```

**Step 2: AI 生成结构化规则**
系统自动生成：
- 页面结构 schema
- 样式规则表
- 校验规则

**Step 3: 预览和调整**
- 查看生成的规则
- 调整字号/行距
- 保存为模板

### 数据结构

```typescript
interface Template {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  content: string;
  format: string;
  rules?: {
    page_structure?: any;
    style_rules?: any;
    validation_rules?: any;
  };
  preview_content?: string;
  created_at: string;
  updated_at?: string;
}
```

---

## 2. 个人素材库增强

### 新增字段

- **source**: 来源（manual/ai_generated/imported）
- **tags**: 标签数组，支持自定义
- **status**: 状态（unused/used/in_project）
- **project_ids**: 关联的项目 ID 数组
- **updated_at**: 最近更新时间

### 核心功能

#### 2.1 标签管理
- 自动标签建议
- 手动编辑标签
- 按标签筛选素材

#### 2.2 项目关联
- 素材可关联多个项目
- 显示关联项目数量
- 项目侧边栏显示已关联素材

#### 2.3 状态管理
- 未使用：新创建的素材
- 已使用：已在文章中使用
- 已加入项目：已关联到项目

#### 2.4 AI 整理功能
- 自动打标签
- 合并相似素材
- 推荐可组合成文章的素材集合
- 推荐关联项目

### 使用场景

```typescript
// 创建素材
await createMaterial({
  user_id: userId,
  title: '素材标题',
  material_type: 'experience',
  content: '素材内容',
  source: 'manual',
  tags: ['技术', '产品'],
  status: 'unused',
  project_ids: [],
});

// 关联项目
await linkMaterialToProjects(materialId, [projectId1, projectId2]);

// 更新标签
await updateMaterialTags(materialId, ['新标签1', '新标签2']);

// AI 整理
const result = await organizeMaterials(materials);
```

---

## 3. 参考文章库增强

### 新增字段

- **source_url**: 文章来源链接
- **tags**: 标签数组
- **ai_analysis**: AI 分析结果
  - core_points: 核心观点
  - structure: 文章结构
  - borrowable_segments: 可借鉴段落
  - recommended_projects: 推荐项目

### 核心功能

#### 3.1 AI 分析
点击"AI 整理"按钮，系统自动：
- 提取核心观点（3-5 个）
- 分析文章结构（引言、主体、结论）
- 识别可借鉴段落
- 推荐适合的项目

#### 3.2 观点提取
每个提取的观点都支持：
- 一键加入素材库
- 加入项目草稿
- 查看适用场景

#### 3.3 结构分析
展示文章的：
- 引言概要
- 主要章节
- 结论概要

### 使用场景

```typescript
// 创建参考文章
await createReferenceArticle({
  user_id: userId,
  title: '文章标题',
  content: '文章内容',
  source_type: '博客',
  source_url: 'https://example.com',
  tags: [],
});

// AI 分析
const analysis = await analyzeReferenceArticle(title, content);
await updateReferenceAnalysis(articleId, analysis);

// 分析结果示例
{
  "core_points": [
    "核心观点1",
    "核心观点2",
    "核心观点3"
  ],
  "structure": {
    "introduction": "引言概要",
    "main_sections": ["章节1", "章节2"],
    "conclusion": "结论概要"
  },
  "borrowable_segments": [
    {
      "content": "可借鉴的段落",
      "usage": "适用场景说明"
    }
  ],
  "tags": ["标签1", "标签2"]
}
```

---

## 4. AI 整理助手

### 入口位置
- 素材库右上角：🧠 AI 整理
- 参考文章库：每篇文章的 AI 整理按钮

### 功能说明

#### 对个人素材库
- 自动打标签（主题/立场/情绪）
- 合并相似素材
- 推荐可组合成文章的素材集合
- 推荐关联项目

#### 对参考文章库
- 拆解文章结构
- 抽取可迁移观点
- 转化为可写作素材

### 输出交互
- 卡片形式展示观点
- 每条都能：
  - 加入某项目
  - 插入当前文档
  - 存为素材

---

## 5. 数据库更新

### 新增字段

```sql
-- materials 表
ALTER TABLE materials 
ADD COLUMN source TEXT DEFAULT 'manual',
ADD COLUMN tags TEXT[] DEFAULT '{}',
ADD COLUMN status TEXT DEFAULT 'unused',
ADD COLUMN project_ids TEXT[] DEFAULT '{}',
ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();

-- reference_articles 表
ALTER TABLE reference_articles
ADD COLUMN source_url TEXT,
ADD COLUMN tags TEXT[] DEFAULT '{}',
ADD COLUMN ai_analysis JSONB,
ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();

-- templates 表
ALTER TABLE templates
ADD COLUMN description TEXT,
ADD COLUMN rules JSONB,
ADD COLUMN preview_content TEXT,
ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
```

### 索引优化

```sql
CREATE INDEX idx_materials_tags ON materials USING GIN(tags);
CREATE INDEX idx_reference_articles_tags ON reference_articles USING GIN(tags);
CREATE INDEX idx_materials_project_ids ON materials USING GIN(project_ids);
```

---

## 6. API 函数

### 新增 API

```typescript
// 模板相关
generateTemplateRules(description: string): Promise<any>

// 素材相关
linkMaterialToProjects(materialId: string, projectIds: string[]): Promise<Material>
updateMaterialTags(materialId: string, tags: string[]): Promise<Material>
organizeMaterials(materials: Material[]): Promise<any>
getMaterialsByTags(userId: string, tags: string[]): Promise<Material[]>

// 参考文章相关
analyzeReferenceArticle(title: string, content: string): Promise<any>
updateReferenceAnalysis(articleId: string, analysis: any): Promise<ReferenceArticle>
getReferencesByTags(userId: string, tags: string[]): Promise<ReferenceArticle[]>
```

---

## 7. 使用建议

### 模板管理
1. 使用 AI 生成模板时，描述要尽量详细
2. 生成后检查规则是否完整
3. 补充缺失的格式要求
4. 模板仅在终稿输出时应用

### 素材库
1. 及时为素材添加标签
2. 定期使用 AI 整理功能
3. 将相关素材关联到项目
4. 利用筛选功能快速查找

### 参考文章库
1. 添加文章后立即进行 AI 分析
2. 将有价值的观点加入素材库
3. 参考文章结构进行写作
4. 利用可借鉴段落提升写作质量

---

## 8. 注意事项

1. **API 配置**：使用 AI 功能前需在设置页面配置 LLM API
2. **数据安全**：所有数据存储在 Supabase，确保数据安全
3. **性能优化**：大量素材时建议使用标签筛选
4. **版本兼容**：新功能向后兼容，不影响现有数据

---

## 9. 后续规划

- [ ] 素材智能推荐
- [ ] 文章自动生成
- [ ] 多人协作功能
- [ ] 版本历史管理
- [ ] 导出多种格式
