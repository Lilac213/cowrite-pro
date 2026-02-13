#!/bin/bash

# Agent 集成测试脚本
# 测试所有 Agent 的输入输出规范、Prompt 运行情况、流程断点

# 配置
SUPABASE_URL="${SUPABASE_URL:-http://localhost:54321}"
SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY:-your-anon-key}"
SUPABASE_SERVICE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-your-service-key}"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 测试结果
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# 辅助函数：打印标题
print_header() {
    echo ""
    echo "========================================"
    echo "$1"
    echo "========================================"
}

# 辅助函数：打印测试结果
print_result() {
    local agent=$1
    local success=$2
    local duration=$3
    local issues=$4
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if [ "$success" = "true" ]; then
        echo -e "${GREEN}✅ $agent 测试通过${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}❌ $agent 测试失败${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    
    echo "  耗时: ${duration}ms"
    
    if [ -n "$issues" ]; then
        echo "  问题:"
        echo "$issues" | while read -r issue; do
            echo "    - $issue"
        done
    fi
    echo ""
}

# 辅助函数：调用 Edge Function
invoke_function() {
    local function_name=$1
    local payload=$2
    
    curl -s -X POST \
        "${SUPABASE_URL}/functions/v1/${function_name}" \
        -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
        -H "Content-Type: application/json" \
        -d "$payload"
}

# 辅助函数：验证 JSON 字段
validate_json_field() {
    local json=$1
    local field=$2
    
    echo "$json" | jq -e "$field" > /dev/null 2>&1
    return $?
}

# 测试 1: Brief Agent
test_brief_agent() {
    print_header "测试 1: Brief Agent"
    
    local start_time=$(date +%s%3N)
    
    local payload=$(cat <<EOF
{
  "project_id": "test-project-$(date +%s)",
  "topic": "AI Agent 在企业中的应用与挑战",
  "user_input": "我想写一篇关于AI Agent在企业中的应用案例和面临的挑战的文章",
  "context": "目标读者是产品经理和技术决策者"
}
EOF
)
    
    echo "输入数据:"
    echo "$payload" | jq '.'
    echo ""
    
    local result=$(invoke_function "brief-agent" "$payload")
    local end_time=$(date +%s%3N)
    local duration=$((end_time - start_time))
    
    echo "返回数据:"
    echo "$result" | jq '.'
    echo ""
    
    # 验证输出
    local issues=""
    
    if ! validate_json_field "$result" '.writing_brief'; then
        issues="${issues}缺少 writing_brief 字段\n"
    fi
    
    if ! validate_json_field "$result" '.writing_brief.topic'; then
        issues="${issues}缺少 writing_brief.topic 字段\n"
    fi
    
    if ! validate_json_field "$result" '.writing_brief.user_core_thesis'; then
        issues="${issues}缺少 writing_brief.user_core_thesis 字段\n"
    fi
    
    if ! validate_json_field "$result" '.writing_brief.confirmed_insights'; then
        issues="${issues}缺少 writing_brief.confirmed_insights 字段\n"
    fi
    
    if ! validate_json_field "$result" '.writing_brief.requirement_meta'; then
        issues="${issues}缺少 writing_brief.requirement_meta 字段\n"
    fi
    
    local success="true"
    if [ -n "$issues" ]; then
        success="false"
    fi
    
    print_result "Brief Agent" "$success" "$duration" "$issues"
    
    # 返回 project_id 供后续测试使用
    echo "$payload" | jq -r '.project_id'
}

# 测试 2: Research Retrieval Agent
test_research_retrieval_agent() {
    print_header "测试 2: Research Retrieval Agent"
    
    local start_time=$(date +%s%3N)
    
    local payload=$(cat <<EOF
{
  "requirementsDoc": {
    "主题": "AI Agent 在企业中的应用与挑战",
    "关键要点": ["AI Agent商业化落地", "用户获取策略", "技术实现挑战"],
    "核心观点": ["AI Agent需要精准的用户画像", "商业化成功依赖于价值验证"],
    "目标读者": "产品经理、技术决策者",
    "写作风格": "专业、实用",
    "预期长度": "3000-5000字"
  },
  "projectId": "test-project-$(date +%s)",
  "userId": "test-user-id"
}
EOF
)
    
    echo "输入数据:"
    echo "$payload" | jq '.'
    echo ""
    
    local result=$(invoke_function "research-retrieval-agent" "$payload")
    local end_time=$(date +%s%3N)
    local duration=$((end_time - start_time))
    
    echo "返回数据（部分）:"
    echo "$result" | jq '{
        search_summary: .search_summary,
        materials_count: (.materials | length)
    }'
    echo ""
    
    # 验证输出
    local issues=""
    
    if ! validate_json_field "$result" '.search_summary'; then
        issues="${issues}缺少 search_summary 字段\n"
    fi
    
    if ! validate_json_field "$result" '.search_summary.interpreted_topic'; then
        issues="${issues}缺少 search_summary.interpreted_topic 字段\n"
    fi
    
    if ! validate_json_field "$result" '.materials'; then
        issues="${issues}缺少 materials 字段\n"
    else
        local materials_count=$(echo "$result" | jq '.materials | length')
        if [ "$materials_count" -eq 0 ]; then
            issues="${issues}未检索到任何资料\n"
        fi
    fi
    
    local success="true"
    if [ -n "$issues" ]; then
        success="false"
    fi
    
    print_result "Research Retrieval Agent" "$success" "$duration" "$issues"
}

# 测试 3: Research Synthesis Agent
test_research_synthesis_agent() {
    print_header "测试 3: Research Synthesis Agent"
    
    local start_time=$(date +%s%3N)
    
    local payload=$(cat <<EOF
{
  "input": {
    "writing_requirements": {
      "topic": "AI Agent 在企业中的应用与挑战",
      "target_audience": "产品经理、技术决策者",
      "key_points": ["AI Agent商业化落地", "用户获取策略"]
    },
    "raw_materials": [
      {
        "title": "AI Agent商业化路径分析",
        "source": "academic",
        "content": "AI Agent的商业化成功在于深入理解其独特价值，需要精准的用户画像和创新的商业模式设计。"
      },
      {
        "title": "用户获取策略研究",
        "source": "news",
        "content": "成功的用户获取策略需要结合产品特性和目标用户群体，采用多渠道营销方法。"
      }
    ]
  }
}
EOF
)
    
    echo "输入数据:"
    echo "$payload" | jq '.'
    echo ""
    
    local result=$(invoke_function "research-synthesis-agent" "$payload")
    local end_time=$(date +%s%3N)
    local duration=$((end_time - start_time))
    
    echo "返回数据:"
    echo "$result" | jq '.'
    echo ""
    
    # 验证输出
    local issues=""
    
    if ! validate_json_field "$result" '.synthesis'; then
        issues="${issues}缺少 synthesis 字段\n"
    fi
    
    if ! validate_json_field "$result" '.synthesis.synthesized_insights'; then
        issues="${issues}缺少 synthesis.synthesized_insights 字段\n"
    fi
    
    if ! validate_json_field "$result" '.synthesis.contradictions_or_gaps'; then
        issues="${issues}缺少 synthesis.contradictions_or_gaps 字段\n"
    fi
    
    local success="true"
    if [ -n "$issues" ]; then
        success="false"
    fi
    
    print_result "Research Synthesis Agent" "$success" "$duration" "$issues"
}

# 测试 4: Structure Agent
test_structure_agent() {
    print_header "测试 4: Structure Agent"
    
    local start_time=$(date +%s%3N)
    
    local payload=$(cat <<EOF
{
  "project_id": "test-project-$(date +%s)"
}
EOF
)
    
    echo "输入数据:"
    echo "$payload" | jq '.'
    echo ""
    
    local result=$(invoke_function "structure-agent" "$payload")
    local end_time=$(date +%s%3N)
    local duration=$((end_time - start_time))
    
    echo "返回数据:"
    echo "$result" | jq '.'
    echo ""
    
    # 验证输出
    local issues=""
    
    if echo "$result" | jq -e '.error' > /dev/null 2>&1; then
        issues="${issues}返回错误: $(echo "$result" | jq -r '.error')\n"
    fi
    
    if ! validate_json_field "$result" '.argument_outline'; then
        issues="${issues}缺少 argument_outline 字段\n"
    fi
    
    local success="true"
    if [ -n "$issues" ]; then
        success="false"
    fi
    
    print_result "Structure Agent" "$success" "$duration" "$issues"
}

# 测试 5: Draft Agent
test_draft_agent() {
    print_header "测试 5: Draft Agent"
    
    local start_time=$(date +%s%3N)
    
    local payload=$(cat <<EOF
{
  "project_id": "test-project-$(date +%s)"
}
EOF
)
    
    echo "输入数据:"
    echo "$payload" | jq '.'
    echo ""
    
    local result=$(invoke_function "draft-agent" "$payload")
    local end_time=$(date +%s%3N)
    local duration=$((end_time - start_time))
    
    echo "返回数据:"
    echo "$result" | jq '.'
    echo ""
    
    # 验证输出
    local issues=""
    
    if echo "$result" | jq -e '.error' > /dev/null 2>&1; then
        issues="${issues}返回错误: $(echo "$result" | jq -r '.error')\n"
    fi
    
    if ! validate_json_field "$result" '.draft_payload'; then
        issues="${issues}缺少 draft_payload 字段\n"
    fi
    
    local success="true"
    if [ -n "$issues" ]; then
        success="false"
    fi
    
    print_result "Draft Agent" "$success" "$duration" "$issues"
}

# 测试 6: Review Agent
test_review_agent() {
    print_header "测试 6: Review Agent"
    
    local start_time=$(date +%s%3N)
    
    local payload=$(cat <<EOF
{
  "project_id": "test-project-$(date +%s)"
}
EOF
)
    
    echo "输入数据:"
    echo "$payload" | jq '.'
    echo ""
    
    local result=$(invoke_function "review-agent" "$payload")
    local end_time=$(date +%s%3N)
    local duration=$((end_time - start_time))
    
    echo "返回数据:"
    echo "$result" | jq '.'
    echo ""
    
    # 验证输出
    local issues=""
    
    if echo "$result" | jq -e '.error' > /dev/null 2>&1; then
        issues="${issues}返回错误: $(echo "$result" | jq -r '.error')\n"
    fi
    
    if ! validate_json_field "$result" '.review_payload'; then
        issues="${issues}缺少 review_payload 字段\n"
    fi
    
    local success="true"
    if [ -n "$issues" ]; then
        success="false"
    fi
    
    print_result "Review Agent" "$success" "$duration" "$issues"
}

# 主函数
main() {
    print_header "Agent 集成测试开始"
    
    echo "测试环境:"
    echo "  Supabase URL: $SUPABASE_URL"
    echo "  测试时间: $(date '+%Y-%m-%d %H:%M:%S')"
    echo ""
    
    # 运行测试
    test_brief_agent
    test_research_retrieval_agent
    test_research_synthesis_agent
    test_structure_agent
    test_draft_agent
    test_review_agent
    
    # 输出总结
    print_header "测试总结"
    
    echo "总测试数: $TOTAL_TESTS"
    echo -e "通过: ${GREEN}$PASSED_TESTS${NC}"
    echo -e "失败: ${RED}$FAILED_TESTS${NC}"
    echo ""
    
    if [ $FAILED_TESTS -eq 0 ]; then
        echo -e "${GREEN}✅ 所有测试通过！${NC}"
        exit 0
    else
        echo -e "${RED}❌ 部分测试失败，请检查上述问题${NC}"
        exit 1
    fi
}

# 运行主函数
main
