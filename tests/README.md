# Agent 集成测试

本目录包含所有 Agent 的集成测试，用于验证输入输出规范、Prompt 运行情况、流程断点。

## 测试流程

测试按照以下顺序执行：

1. **开始**
2. **需求明确** - 调用 `brief-agent`
3. **资料搜索** - 调用 `research-retrieval-agent`
4. **资料整理** - 调用 `research-synthesis-agent`
5. **文章结构** - 调用 `structure-agent`
6. **生成草稿** - 调用 `draft-agent`
7. **内容审校** - 调用 `review-agent`
8. **结束**

## 测试文件

### 1. agent-test.js (推荐)

Node.js 测试脚本，可以直接运行，测试所有 Agent 的输入输出。

**使用方法：**

```bash
# 设置环境变量
export SUPABASE_URL="your-supabase-url"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# 运行测试
node tests/agent-test.js
```

### 2. agent-integration-test.sh

Shell 脚本测试，使用 curl 调用 Edge Functions。

**使用方法：**

```bash
# 设置环境变量
export SUPABASE_URL="your-supabase-url"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# 添加执行权限
chmod +x tests/agent-integration-test.sh

# 运行测试
./tests/agent-integration-test.sh
```

### 3. agent-integration-test.ts

TypeScript 测试文件，需要编译后运行。

**使用方法：**

```bash
# 编译 TypeScript
npx tsc tests/agent-integration-test.ts --outDir dist/tests

# 运行测试
node dist/tests/agent-integration-test.js
```

## 测试内容

### 1. Brief Agent 测试

**测试目标：**
- 验证输入参数完整性
- 验证输出结构符合规范
- 验证生成的需求文档质量

**必需字段：**
- `writing_brief.topic`
- `writing_brief.user_core_thesis`
- `writing_brief.confirmed_insights`
- `writing_brief.requirement_meta`
- `writing_brief.requirement_meta.document_type`
- `writing_brief.requirement_meta.target_audience`

### 2. Research Retrieval Agent 测试

**测试目标：**
- 验证搜索计划生成
- 验证多源资料检索
- 验证资料质量（内容长度、相关性）

**必需字段：**
- `search_summary`
- `search_summary.interpreted_topic`
- `materials`

**质量检查：**
- 至少检索到一定数量的资料
- 超过50%的资料内容应大于100字符

### 3. Research Synthesis Agent 测试

**测试目标：**
- 验证研究洞察生成
- 验证洞察分类和标注
- 验证用户决策位设置

**必需字段：**
- `synthesis.synthesized_insights`
- `synthesis.contradictions_or_gaps`

**每个洞察的必需字段：**
- `id`
- `category`
- `insight`
- `recommended_usage`

### 4. Structure Agent 测试

**测试目标：**
- 验证文章结构生成
- 验证结构块引用研究洞察
- 验证覆盖率检查

**必需字段：**
- `argument_outline.argument_blocks`
- `argument_outline.coverage_check`

**每个结构块的必需字段：**
- `block_id`
- `block_type`
- `title`
- `derived_from` (必须引用研究洞察)

### 5. Draft Agent 测试

**测试目标：**
- 验证草稿生成
- 验证引用标记
- 验证连贯性评分

**必需字段：**
- `draft_payload.draft_blocks`
- `draft_payload.total_word_count`
- `draft_payload.global_coherence_score`

**质量检查：**
- 草稿总字数应大于500字
- 每个块应有引用标记

### 6. Review Agent 测试

**测试目标：**
- 验证四维度审校
- 验证评分系统
- 验证审校结果

**必需字段：**
- `review_payload.logic_issues`
- `review_payload.citation_issues`
- `review_payload.style_issues`
- `review_payload.grammar_issues`
- `review_payload.overall_quality`
- `review_payload.pass`

**评分字段：**
- `overall_score`
- `logic_score`
- `citation_score`
- `style_score`
- `grammar_score`

## 测试报告

测试完成后会生成详细的测试报告，包括：

- 每个Agent的测试结果（通过/失败）
- 执行耗时
- 发现的问题列表
- 输出摘要

## 常见问题

### 1. 环境变量未设置

**错误信息：** `未设置 SUPABASE_SERVICE_ROLE_KEY 环境变量`

**解决方法：**
```bash
export SUPABASE_URL="your-supabase-url"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
```

### 2. Edge Function 未部署

**错误信息：** `HTTP 错误: 404`

**解决方法：**
```bash
# 部署 Edge Functions
supabase functions deploy brief-agent
supabase functions deploy research-retrieval-agent
supabase functions deploy research-synthesis-agent
supabase functions deploy structure-agent
supabase functions deploy draft-agent
supabase functions deploy review-agent
```

### 3. API 密钥无效

**错误信息：** `HTTP 错误: 401` 或 `API 密钥未配置`

**解决方法：**
1. 检查 Supabase 项目的 API 密钥配置
2. 确保 `QIANWEN_API_KEY` 或 `DASHSCOPE_API_KEY` 已正确设置
3. 检查 Supabase Edge Functions 的 Secrets 配置

### 4. 数据库表不存在

**错误信息：** `relation "xxx" does not exist`

**解决方法：**
运行数据库迁移脚本，创建必需的表：
```bash
supabase db push
```

## 修复问题

如果测试失败，请按照以下步骤修复：

1. **查看错误信息** - 测试报告会显示具体的错误信息
2. **检查日志** - 查看 Supabase Edge Functions 的日志
3. **验证输入** - 确保输入数据符合 Agent 的预期
4. **检查依赖** - 确保前置 Agent 已成功运行
5. **修复代码** - 根据错误信息修复 Agent 实现
6. **重新测试** - 修复后重新运行测试

## 测试数据

测试使用以下示例数据：

```javascript
{
  topic: 'AI Agent 在企业中的应用与挑战',
  user_input: '我想写一篇关于AI Agent在企业中的应用案例和面临的挑战的文章，重点关注商业化落地、用户获取和技术实现等方面。',
  context: '目标读者是产品经理和技术决策者，希望了解AI Agent的实际应用场景和成功案例。'
}
```

## 持续集成

可以将测试脚本集成到 CI/CD 流程中：

```yaml
# .github/workflows/agent-test.yml
name: Agent Integration Tests

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v2
    
    - name: Setup Node.js
      uses: actions/setup-node@v2
      with:
        node-version: '18'
    
    - name: Run Agent Tests
      env:
        SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
        SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
      run: node tests/agent-test.js
```
