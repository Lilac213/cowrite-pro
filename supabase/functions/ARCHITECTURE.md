# Edge Functions 代码组织说明

## 目录结构

```
supabase/functions/
├── _shared/                    # 共享代码（源代码真实来源）
│   └── llm/                   # LLM Agent 架构
│       ├── agents/            # 各个 Agent 实现
│       ├── runtime/           # LLM 运行时
│       ├── schemas/           # 数据验证 Schema
│       └── README.md
│
├── brief-agent/               # 需求文档生成
│   ├── index.ts
│   └── llm/                   # ⚠️ 自动生成的副本，不要手动修改
│
├── structure-agent/           # 文章结构生成
│   ├── index.ts
│   └── llm/                   # ⚠️ 自动生成的副本，不要手动修改
│
└── ... (其他函数)
```

## 重要说明

### 为什么每个函数都有 `llm` 目录？

Supabase Edge Functions 的部署系统**不支持自动打包 `_shared` 目录**。因此：

1. **`_shared/llm`** 是唯一的源代码真实来源（Single Source of Truth）
2. 各函数目录中的 `llm` 副本是**部署前自动生成的**，仅用于满足部署要求
3. **不要直接修改**各函数中的 `llm` 副本

### 如何修改共享代码？

1. 在 `_shared/llm` 中修改代码
2. 运行同步脚本：
   ```bash
   bash supabase/functions/sync-shared.sh
   ```
3. 部署更新后的函数

### 同步脚本做了什么？

`sync-shared.sh` 脚本会：
1. 删除各函数中的旧 `llm` 副本
2. 从 `_shared/llm` 复制最新代码
3. 自动调整 import 路径（`../_shared/llm/` → `./llm/`）

## Agent 列表

| Agent | 功能 | 输入 | 输出 |
|-------|------|------|------|
| `brief-agent` | 生成需求文档 | topic, user_input | writing_brief |
| `research-retrieval` | 资料搜索 | project_id, search_depth | research_sources |
| `research-synthesis` | 资料整理 | project_id | research_pack |
| `structure-agent` | 文章结构生成 | project_id | argument_outline |
| `draft-agent` | 草稿生成 | project_id | draft_blocks |
| `review-agent` | 内容审校 | project_id | review_report |
| `adjust-article-structure` | 结构调整 | coreThesis, argumentBlocks | adjusted_structure |

## 架构优势

- ✅ **统一的 Runtime**：所有 Agent 共享相同的 LLM 调用、解析、验证逻辑
- ✅ **标准化 Schema**：每个 Agent 都有明确的输入输出定义
- ✅ **三层防护解析**：字符归一化 + JSON 提取 + 信封模式
- ✅ **完整的日志系统**：记录每次运行的输入、输出、延迟、状态
- ✅ **易于维护**：修改共享逻辑只需更新 `_shared/llm`

## 部署流程

```bash
# 1. 修改代码（在 _shared/llm 中）
vim supabase/functions/_shared/llm/agents/briefAgent.ts

# 2. 同步到各函数
bash supabase/functions/sync-shared.sh

# 3. 部署（通过 supabase_deploy_edge_function 工具）
# 工具会自动处理部署
```
