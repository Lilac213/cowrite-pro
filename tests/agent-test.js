/**
 * Agent 集成测试脚本
 * 测试所有 Agent 的输入输出规范、Prompt 运行情况、流程断点
 * 
 * 使用方法：
 * 1. 确保已设置环境变量：SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * 2. 运行：node tests/agent-test.js
 */

import https from 'https';
import http from 'http';

// 配置
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

// 测试结果
const testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  details: []
};

// 辅助函数：调用 Edge Function
async function invokeFunction(functionName, payload) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${SUPABASE_URL}/functions/v1/${functionName}`);
    const protocol = url.protocol === 'https:' ? https : http;
    
    const postData = JSON.stringify(payload);
    
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = protocol.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({
            success: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            data: jsonData
          });
        } catch (error) {
          resolve({
            success: false,
            status: res.statusCode,
            error: `JSON 解析失败: ${error.message}`,
            rawData: data
          });
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.write(postData);
    req.end();
  });
}

// 辅助函数：验证 JSON 字段
function validateField(data, path) {
  const parts = path.split('.');
  let current = data;
  
  for (const part of parts) {
    if (current === null || current === undefined) {
      return false;
    }
    if (!(part in current)) {
      return false;
    }
    current = current[part];
  }
  
  return true;
}

// 辅助函数：打印测试结果
function printTestResult(agentName, success, duration, issues, output) {
  testResults.total++;
  
  if (success) {
    testResults.passed++;
    console.log(`✅ ${agentName} 测试通过`);
  } else {
    testResults.failed++;
    console.log(`❌ ${agentName} 测试失败`);
  }
  
  console.log(`  耗时: ${duration}ms`);
  
  if (issues.length > 0) {
    console.log('  问题:');
    issues.forEach(issue => {
      console.log(`    - ${issue}`);
    });
  }
  
  if (output) {
    console.log('  输出摘要:');
    console.log(`    ${JSON.stringify(output).substring(0, 200)}...`);
  }
  
  console.log('');
  
  testResults.details.push({
    agent: agentName,
    success,
    duration,
    issues,
    output
  });
}

// 测试 1: Brief Agent
async function testBriefAgent() {
  console.log('========== 测试 1: Brief Agent ==========\n');
  
  const startTime = Date.now();
  const issues = [];
  
  const payload = {
    project_id: `test-project-${Date.now()}`,
    topic: 'AI Agent 在企业中的应用与挑战',
    user_input: '我想写一篇关于AI Agent在企业中的应用案例和面临的挑战的文章，重点关注商业化落地、用户获取和技术实现等方面。',
    context: '目标读者是产品经理和技术决策者，希望了解AI Agent的实际应用场景和成功案例。'
  };
  
  console.log('输入数据:');
  console.log(JSON.stringify(payload, null, 2));
  console.log('');
  
  try {
    const result = await invokeFunction('brief-agent', payload);
    const duration = Date.now() - startTime;
    
    console.log('返回数据:');
    console.log(JSON.stringify(result.data, null, 2).substring(0, 500) + '...\n');
    
    if (!result.success) {
      issues.push(`HTTP 错误: ${result.status}`);
      if (result.data.error) {
        issues.push(`错误信息: ${result.data.error}`);
      }
      printTestResult('Brief Agent', false, duration, issues, result.data);
      return null;
    }
    
    // 验证输出结构
    if (!validateField(result.data, 'writing_brief')) {
      issues.push('缺少 writing_brief 字段');
    } else {
      if (!validateField(result.data, 'writing_brief.topic')) {
        issues.push('缺少 writing_brief.topic 字段');
      }
      if (!validateField(result.data, 'writing_brief.user_core_thesis')) {
        issues.push('缺少 writing_brief.user_core_thesis 字段');
      }
      if (!validateField(result.data, 'writing_brief.confirmed_insights')) {
        issues.push('缺少 writing_brief.confirmed_insights 字段');
      }
      if (!validateField(result.data, 'writing_brief.requirement_meta')) {
        issues.push('缺少 writing_brief.requirement_meta 字段');
      }
    }
    
    const success = issues.length === 0;
    printTestResult('Brief Agent', success, duration, issues, {
      topic: result.data.writing_brief?.topic,
      insights_count: result.data.writing_brief?.confirmed_insights?.length
    });
    
    return success ? payload.project_id : null;
    
  } catch (error) {
    const duration = Date.now() - startTime;
    issues.push(`异常: ${error.message}`);
    printTestResult('Brief Agent', false, duration, issues, null);
    return null;
  }
}

// 测试 2: Research Retrieval Agent
async function testResearchRetrievalAgent() {
  console.log('========== 测试 2: Research Retrieval Agent ==========\n');
  
  const startTime = Date.now();
  const issues = [];
  
  const payload = {
    requirementsDoc: {
      主题: 'AI Agent 在企业中的应用与挑战',
      关键要点: ['AI Agent商业化落地', '用户获取策略', '技术实现挑战'],
      核心观点: ['AI Agent需要精准的用户画像', '商业化成功依赖于价值验证'],
      目标读者: '产品经理、技术决策者',
      写作风格: '专业、实用',
      预期长度: '3000-5000字'
    },
    projectId: `test-project-${Date.now()}`,
    userId: 'test-user-id'
  };
  
  console.log('输入数据:');
  console.log(JSON.stringify(payload, null, 2));
  console.log('');
  
  try {
    const result = await invokeFunction('research-retrieval-agent', payload);
    const duration = Date.now() - startTime;
    
    // 适配新的返回结构：result.data.data 包含实际数据
    const actualData = result.data?.data || result.data;
    
    console.log('返回数据（部分）:');
    const summary = {
      search_summary: actualData?.search_summary,
      academic_sources_count: actualData?.academic_sources?.length || 0,
      news_sources_count: actualData?.news_sources?.length || 0,
      web_sources_count: actualData?.web_sources?.length || 0,
      stats: result.data?.stats
    };
    console.log(JSON.stringify(summary, null, 2) + '\n');
    
    if (!result.success) {
      issues.push(`HTTP 错误: ${result.status}`);
      if (result.data.error) {
        issues.push(`错误信息: ${result.data.error}`);
      }
      printTestResult('Research Retrieval Agent', false, duration, issues, result.data);
      return false;
    }
    
    // 验证输出结构（适配新格式）
    if (!validateField(actualData, 'search_summary')) {
      issues.push('缺少 search_summary 字段');
    } else {
      if (!validateField(actualData, 'search_summary.interpreted_topic')) {
        issues.push('缺少 search_summary.interpreted_topic 字段');
      }
    }
    
    // 检查各类资料源
    const totalMaterials = (actualData?.academic_sources?.length || 0) +
                          (actualData?.news_sources?.length || 0) +
                          (actualData?.web_sources?.length || 0);
    
    if (totalMaterials === 0) {
      issues.push('未检索到任何资料（学术、新闻、网络来源均为空）');
    } else {
      // 检查资料质量
      const allMaterials = [
        ...(actualData?.academic_sources || []),
        ...(actualData?.news_sources || []),
        ...(actualData?.web_sources || [])
      ];
      
      const materialsWithContent = allMaterials.filter(m => 
        (m.full_text && m.full_text.length > 100) || 
        (m.abstract && m.abstract.length > 100) ||
        (m.content && m.content.length > 100)
      );
      
      if (materialsWithContent.length < totalMaterials * 0.3) {
        issues.push(`超过70%的资料内容不足（内容少于100字符）`);
      }
    }
    
    const success = issues.length === 0;
    printTestResult('Research Retrieval Agent', success, duration, issues, summary);
    return success;
    
  } catch (error) {
    const duration = Date.now() - startTime;
    issues.push(`异常: ${error.message}`);
    printTestResult('Research Retrieval Agent', false, duration, issues, null);
    return false;
  }
}

// 测试 3: Research Synthesis Agent
async function testResearchSynthesisAgent() {
  console.log('========== 测试 3: Research Synthesis Agent ==========\n');
  
  const startTime = Date.now();
  const issues = [];
  
  const payload = {
    input: {
      writing_requirements: {
        topic: 'AI Agent 在企业中的应用与挑战',
        target_audience: '产品经理、技术决策者',
        key_points: ['AI Agent商业化落地', '用户获取策略']
      },
      raw_materials: [
        {
          title: 'AI Agent商业化路径分析',
          source: 'academic',
          content: 'AI Agent的商业化成功在于深入理解其独特价值，需要精准的用户画像和创新的商业模式设计。研究表明，成功的AI Agent产品通常具有清晰的价值主张和明确的目标用户群体。'
        },
        {
          title: '用户获取策略研究',
          source: 'news',
          content: '成功的用户获取策略需要结合产品特性和目标用户群体，采用多渠道营销方法。数据驱动的用户获取策略能够显著提高转化率和用户留存率。'
        }
      ]
    }
  };
  
  console.log('输入数据:');
  console.log(JSON.stringify(payload, null, 2));
  console.log('');
  
  try {
    const result = await invokeFunction('research-synthesis-agent', payload);
    const duration = Date.now() - startTime;
    
    console.log('返回数据:');
    console.log(JSON.stringify(result.data, null, 2).substring(0, 500) + '...\n');
    
    if (!result.success) {
      issues.push(`HTTP 错误: ${result.status}`);
      if (result.data.error) {
        issues.push(`错误信息: ${result.data.error}`);
      }
      printTestResult('Research Synthesis Agent', false, duration, issues, result.data);
      return false;
    }
    
    // 验证输出结构
    if (!validateField(result.data, 'synthesis')) {
      issues.push('缺少 synthesis 字段');
    } else {
      if (!validateField(result.data, 'synthesis.synthesized_insights')) {
        issues.push('缺少 synthesis.synthesized_insights 字段');
      } else {
        const insights = result.data.synthesis.synthesized_insights;
        if (insights.length === 0) {
          issues.push('未生成任何研究洞察');
        } else {
          // 检查每个洞察的必需字段
          insights.forEach((insight, i) => {
            if (!insight.id) issues.push(`洞察 ${i + 1} 缺少 id`);
            if (!insight.category) issues.push(`洞察 ${i + 1} 缺少 category`);
            if (!insight.insight) issues.push(`洞察 ${i + 1} 缺少 insight`);
            if (!insight.recommended_usage) issues.push(`洞察 ${i + 1} 缺少 recommended_usage`);
          });
        }
      }
      
      if (!validateField(result.data, 'synthesis.contradictions_or_gaps')) {
        issues.push('缺少 synthesis.contradictions_or_gaps 字段');
      }
    }
    
    const success = issues.length === 0;
    printTestResult('Research Synthesis Agent', success, duration, issues, {
      insights_count: result.data.synthesis?.synthesized_insights?.length,
      gaps_count: result.data.synthesis?.contradictions_or_gaps?.length
    });
    return success;
    
  } catch (error) {
    const duration = Date.now() - startTime;
    issues.push(`异常: ${error.message}`);
    printTestResult('Research Synthesis Agent', false, duration, issues, null);
    return false;
  }
}

// 测试 4: Structure Agent
async function testStructureAgent() {
  console.log('========== 测试 4: Structure Agent ==========\n');
  
  const startTime = Date.now();
  const issues = [];
  
  const payload = {
    project_id: `test-project-${Date.now()}`
  };
  
  console.log('输入数据:');
  console.log(JSON.stringify(payload, null, 2));
  console.log('');
  
  try {
    const result = await invokeFunction('structure-agent', payload);
    const duration = Date.now() - startTime;
    
    console.log('返回数据:');
    console.log(JSON.stringify(result.data, null, 2).substring(0, 500) + '...\n');
    
    if (!result.success) {
      issues.push(`HTTP 错误: ${result.status}`);
      if (result.data.error) {
        issues.push(`错误信息: ${result.data.error}`);
      }
      printTestResult('Structure Agent', false, duration, issues, result.data);
      return false;
    }
    
    // 验证输出结构
    if (!validateField(result.data, 'argument_outline')) {
      issues.push('缺少 argument_outline 字段');
    } else {
      if (!validateField(result.data, 'argument_outline.argument_blocks')) {
        issues.push('缺少 argument_outline.argument_blocks 字段');
      } else {
        const blocks = result.data.argument_outline.argument_blocks;
        if (blocks.length === 0) {
          issues.push('未生成任何文章结构块');
        } else {
          // 检查每个块的必需字段
          blocks.forEach((block, i) => {
            if (!block.block_id) issues.push(`结构块 ${i + 1} 缺少 block_id`);
            if (!block.block_type) issues.push(`结构块 ${i + 1} 缺少 block_type`);
            if (!block.title) issues.push(`结构块 ${i + 1} 缺少 title`);
            if (!block.derived_from || block.derived_from.length === 0) {
              issues.push(`结构块 ${i + 1} 缺少 derived_from（必须引用研究洞察）`);
            }
          });
        }
      }
      
      if (!validateField(result.data, 'argument_outline.coverage_check')) {
        issues.push('缺少 argument_outline.coverage_check 字段');
      }
    }
    
    const success = issues.length === 0;
    printTestResult('Structure Agent', success, duration, issues, {
      blocks_count: result.data.argument_outline?.argument_blocks?.length
    });
    return success;
    
  } catch (error) {
    const duration = Date.now() - startTime;
    issues.push(`异常: ${error.message}`);
    printTestResult('Structure Agent', false, duration, issues, null);
    return false;
  }
}

// 测试 5: Draft Agent
async function testDraftAgent() {
  console.log('========== 测试 5: Draft Agent ==========\n');
  
  const startTime = Date.now();
  const issues = [];
  
  const payload = {
    project_id: `test-project-${Date.now()}`
  };
  
  console.log('输入数据:');
  console.log(JSON.stringify(payload, null, 2));
  console.log('');
  
  try {
    const result = await invokeFunction('draft-agent', payload);
    const duration = Date.now() - startTime;
    
    console.log('返回数据:');
    console.log(JSON.stringify(result.data, null, 2).substring(0, 500) + '...\n');
    
    if (!result.success) {
      issues.push(`HTTP 错误: ${result.status}`);
      if (result.data.error) {
        issues.push(`错误信息: ${result.data.error}`);
      }
      printTestResult('Draft Agent', false, duration, issues, result.data);
      return false;
    }
    
    // 验证输出结构
    if (!validateField(result.data, 'draft_payload')) {
      issues.push('缺少 draft_payload 字段');
    } else {
      if (!validateField(result.data, 'draft_payload.draft_blocks')) {
        issues.push('缺少 draft_payload.draft_blocks 字段');
      } else {
        const blocks = result.data.draft_payload.draft_blocks;
        if (blocks.length === 0) {
          issues.push('未生成任何草稿块');
        } else {
          // 检查每个块的必需字段
          blocks.forEach((block, i) => {
            if (!block.block_id) issues.push(`草稿块 ${i + 1} 缺少 block_id`);
            if (!block.content || block.content.length < 50) {
              issues.push(`草稿块 ${i + 1} 内容不足（少于50字符）`);
            }
            if (!block.citations || block.citations.length === 0) {
              issues.push(`草稿块 ${i + 1} 缺少引用（必须引用研究资料）`);
            }
          });
        }
      }
      
      if (!validateField(result.data, 'draft_payload.total_word_count')) {
        issues.push('缺少 draft_payload.total_word_count 字段');
      } else if (result.data.draft_payload.total_word_count < 500) {
        issues.push('草稿总字数不足500字');
      }
      
      if (!validateField(result.data, 'draft_payload.global_coherence_score')) {
        issues.push('缺少 draft_payload.global_coherence_score 字段');
      }
    }
    
    const success = issues.length === 0;
    printTestResult('Draft Agent', success, duration, issues, {
      blocks_count: result.data.draft_payload?.draft_blocks?.length,
      total_word_count: result.data.draft_payload?.total_word_count,
      coherence_score: result.data.draft_payload?.global_coherence_score
    });
    return success;
    
  } catch (error) {
    const duration = Date.now() - startTime;
    issues.push(`异常: ${error.message}`);
    printTestResult('Draft Agent', false, duration, issues, null);
    return false;
  }
}

// 测试 6: Review Agent
async function testReviewAgent() {
  console.log('========== 测试 6: Review Agent ==========\n');
  
  const startTime = Date.now();
  const issues = [];
  
  const payload = {
    project_id: `test-project-${Date.now()}`
  };
  
  console.log('输入数据:');
  console.log(JSON.stringify(payload, null, 2));
  console.log('');
  
  try {
    const result = await invokeFunction('review-agent', payload);
    const duration = Date.now() - startTime;
    
    console.log('返回数据:');
    console.log(JSON.stringify(result.data, null, 2).substring(0, 500) + '...\n');
    
    if (!result.success) {
      issues.push(`HTTP 错误: ${result.status}`);
      if (result.data.error) {
        issues.push(`错误信息: ${result.data.error}`);
      }
      printTestResult('Review Agent', false, duration, issues, result.data);
      return false;
    }
    
    // 验证输出结构
    if (!validateField(result.data, 'review_payload')) {
      issues.push('缺少 review_payload 字段');
    } else {
      if (!validateField(result.data, 'review_payload.logic_issues')) {
        issues.push('缺少 review_payload.logic_issues 字段');
      }
      if (!validateField(result.data, 'review_payload.citation_issues')) {
        issues.push('缺少 review_payload.citation_issues 字段');
      }
      if (!validateField(result.data, 'review_payload.style_issues')) {
        issues.push('缺少 review_payload.style_issues 字段');
      }
      if (!validateField(result.data, 'review_payload.grammar_issues')) {
        issues.push('缺少 review_payload.grammar_issues 字段');
      }
      
      if (!validateField(result.data, 'review_payload.overall_quality')) {
        issues.push('缺少 review_payload.overall_quality 字段');
      } else {
        const quality = result.data.review_payload.overall_quality;
        if (quality.overall_score === undefined) issues.push('缺少总体评分');
        if (quality.logic_score === undefined) issues.push('缺少逻辑评分');
        if (quality.citation_score === undefined) issues.push('缺少引用评分');
        if (quality.style_score === undefined) issues.push('缺少风格评分');
        if (quality.grammar_score === undefined) issues.push('缺少语法评分');
      }
      
      if (!validateField(result.data, 'review_payload.pass')) {
        issues.push('缺少 review_payload.pass 字段');
      }
    }
    
    const success = issues.length === 0;
    printTestResult('Review Agent', success, duration, issues, {
      total_issues: (result.data.review_payload?.logic_issues?.length || 0) +
                    (result.data.review_payload?.citation_issues?.length || 0) +
                    (result.data.review_payload?.style_issues?.length || 0) +
                    (result.data.review_payload?.grammar_issues?.length || 0),
      overall_score: result.data.review_payload?.overall_quality?.overall_score,
      pass: result.data.review_payload?.pass
    });
    return success;
    
  } catch (error) {
    const duration = Date.now() - startTime;
    issues.push(`异常: ${error.message}`);
    printTestResult('Review Agent', false, duration, issues, null);
    return false;
  }
}

// 主函数
async function main() {
  console.log('========================================');
  console.log('Agent 集成测试');
  console.log('========================================\n');
  
  console.log('测试环境:');
  console.log(`  Supabase URL: ${SUPABASE_URL}`);
  console.log(`  测试时间: ${new Date().toLocaleString('zh-CN')}`);
  console.log('');
  
  // 检查环境变量
  if (!SUPABASE_SERVICE_KEY) {
    console.error('❌ 错误: 未设置 SUPABASE_SERVICE_ROLE_KEY 环境变量');
    console.log('\n请设置环境变量后重试:');
    console.log('  export SUPABASE_URL="your-supabase-url"');
    console.log('  export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"');
    process.exit(1);
  }
  
  // 运行测试
  await testBriefAgent();
  await testResearchRetrievalAgent();
  await testResearchSynthesisAgent();
  await testStructureAgent();
  await testDraftAgent();
  await testReviewAgent();
  
  // 输出总结
  console.log('========================================');
  console.log('测试总结');
  console.log('========================================\n');
  
  console.log(`总测试数: ${testResults.total}`);
  console.log(`通过: ${testResults.passed}`);
  console.log(`失败: ${testResults.failed}`);
  console.log('');
  
  if (testResults.failed === 0) {
    console.log('✅ 所有测试通过！');
    process.exit(0);
  } else {
    console.log('❌ 部分测试失败，请检查上述问题');
    console.log('\n失败的测试:');
    testResults.details
      .filter(r => !r.success)
      .forEach(r => {
        console.log(`\n${r.agent}:`);
        r.issues.forEach(issue => console.log(`  - ${issue}`));
      });
    process.exit(1);
  }
}

// 运行主函数
main().catch(error => {
  console.error('测试执行失败:', error);
  process.exit(1);
});
