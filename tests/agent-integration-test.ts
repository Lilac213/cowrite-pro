/**
 * Agent 集成测试
 * 测试所有 Agent 的输入输出规范、Prompt 运行情况、流程断点
 * 
 * 测试流程：
 * 1. 开始
 * 2. 需求明确（brief-agent）
 * 3. 资料搜索（research-retrieval-agent）
 * 4. 资料整理（research-synthesis-agent）
 * 5. 文章结构（structure-agent）
 * 6. 生成草稿（draft-agent）
 * 7. 内容审校（review-agent）
 * 8. 结束
 */

import { createClient } from '@supabase/supabase-js';

// 配置
const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// 测试数据
const TEST_PROJECT = {
  id: '',
  title: 'AI Agent 在企业中的应用与挑战',
  user_input: '我想写一篇关于AI Agent在企业中的应用案例和面临的挑战的文章，重点关注商业化落地、用户获取和技术实现等方面。',
  context: '目标读者是产品经理和技术决策者，希望了解AI Agent的实际应用场景和成功案例。'
};

// 测试结果收集
interface TestResult {
  agent: string;
  success: boolean;
  duration: number;
  input: any;
  output: any;
  error?: string;
  issues: string[];
}

const testResults: TestResult[] = [];

// 辅助函数：调用 Edge Function
async function invokeEdgeFunction(functionName: string, payload: any): Promise<any> {
  const startTime = Date.now();
  
  try {
    const { data, error } = await supabase.functions.invoke(functionName, {
      body: payload
    });

    if (error) {
      throw error;
    }

    return {
      success: true,
      data,
      duration: Date.now() - startTime
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
      duration: Date.now() - startTime
    };
  }
}

// 辅助函数：验证 JSON 结构
function validateJsonStructure(data: any, requiredFields: string[], path: string = ''): string[] {
  const issues: string[] = [];
  
  for (const field of requiredFields) {
    const parts = field.split('.');
    let current = data;
    let currentPath = path;
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      currentPath = currentPath ? `${currentPath}.${part}` : part;
      
      if (current === null || current === undefined) {
        issues.push(`路径 ${currentPath} 的父对象为空`);
        break;
      }
      
      if (!(part in current)) {
        issues.push(`缺少必需字段: ${currentPath}`);
        break;
      }
      
      current = current[part];
    }
  }
  
  return issues;
}

// 测试 1: Brief Agent
async function testBriefAgent(projectId: string): Promise<TestResult> {
  console.log('\n========== 测试 Brief Agent ==========');
  const issues: string[] = [];
  const startTime = Date.now();
  
  try {
    const result = await invokeEdgeFunction('brief-agent', {
      project_id: projectId,
      topic: TEST_PROJECT.title,
      user_input: TEST_PROJECT.user_input,
      context: TEST_PROJECT.context
    });

    if (!result.success) {
      return {
        agent: 'brief-agent',
        success: false,
        duration: result.duration,
        input: { project_id: projectId, topic: TEST_PROJECT.title },
        output: null,
        error: result.error,
        issues: [`调用失败: ${result.error}`]
      };
    }

    console.log('Brief Agent 返回数据:', JSON.stringify(result.data, null, 2));

    // 验证输出结构
    const requiredFields = [
      'writing_brief',
      'writing_brief.topic',
      'writing_brief.user_core_thesis',
      'writing_brief.confirmed_insights',
      'writing_brief.requirement_meta',
      'writing_brief.requirement_meta.document_type',
      'writing_brief.requirement_meta.target_audience'
    ];
    
    const validationIssues = validateJsonStructure(result.data, requiredFields);
    issues.push(...validationIssues);

    // 检查是否有空值
    if (!result.data.writing_brief?.topic) {
      issues.push('topic 字段为空');
    }
    if (!result.data.writing_brief?.user_core_thesis) {
      issues.push('user_core_thesis 字段为空');
    }
    if (!result.data.writing_brief?.confirmed_insights || result.data.writing_brief.confirmed_insights.length === 0) {
      issues.push('confirmed_insights 为空或长度为0');
    }

    return {
      agent: 'brief-agent',
      success: issues.length === 0,
      duration: Date.now() - startTime,
      input: { project_id: projectId, topic: TEST_PROJECT.title },
      output: result.data,
      issues
    };
  } catch (error: any) {
    return {
      agent: 'brief-agent',
      success: false,
      duration: Date.now() - startTime,
      input: { project_id: projectId },
      output: null,
      error: error.message,
      issues: [error.message]
    };
  }
}

// 测试 2: Research Retrieval Agent
async function testResearchRetrievalAgent(projectId: string, userId: string): Promise<TestResult> {
  console.log('\n========== 测试 Research Retrieval Agent ==========');
  const issues: string[] = [];
  const startTime = Date.now();
  
  try {
    const requirementsDoc = {
      主题: TEST_PROJECT.title,
      关键要点: ['AI Agent商业化落地', '用户获取策略', '技术实现挑战'],
      核心观点: ['AI Agent需要精准的用户画像', '商业化成功依赖于价值验证'],
      目标读者: '产品经理、技术决策者',
      写作风格: '专业、实用',
      预期长度: '3000-5000字'
    };

    const result = await invokeEdgeFunction('research-retrieval-agent', {
      requirementsDoc,
      projectId,
      userId
    });

    if (!result.success) {
      return {
        agent: 'research-retrieval-agent',
        success: false,
        duration: result.duration,
        input: { requirementsDoc },
        output: null,
        error: result.error,
        issues: [`调用失败: ${result.error}`]
      };
    }

    console.log('Research Retrieval Agent 返回数据（部分）:', {
      search_summary: result.data.search_summary,
      materials_count: result.data.materials?.length || 0
    });

    // 验证输出结构
    const requiredFields = [
      'search_summary',
      'search_summary.interpreted_topic',
      'materials'
    ];
    
    const validationIssues = validateJsonStructure(result.data, requiredFields);
    issues.push(...validationIssues);

    // 检查是否有搜索结果
    if (!result.data.materials || result.data.materials.length === 0) {
      issues.push('未检索到任何资料');
    } else {
      // 检查资料质量
      const materialsWithContent = result.data.materials.filter((m: any) => 
        m.content && m.content.length > 100
      );
      if (materialsWithContent.length < result.data.materials.length * 0.5) {
        issues.push(`超过50%的资料内容不足（内容少于100字符）`);
      }
    }

    return {
      agent: 'research-retrieval-agent',
      success: issues.length === 0,
      duration: Date.now() - startTime,
      input: { requirementsDoc },
      output: {
        search_summary: result.data.search_summary,
        materials_count: result.data.materials?.length || 0
      },
      issues
    };
  } catch (error: any) {
    return {
      agent: 'research-retrieval-agent',
      success: false,
      duration: Date.now() - startTime,
      input: { projectId },
      output: null,
      error: error.message,
      issues: [error.message]
    };
  }
}

// 测试 3: Research Synthesis Agent
async function testResearchSynthesisAgent(projectId: string, sessionId: string): Promise<TestResult> {
  console.log('\n========== 测试 Research Synthesis Agent ==========');
  const issues: string[] = [];
  const startTime = Date.now();
  
  try {
    const result = await invokeEdgeFunction('research-synthesis-agent', {
      projectId,
      sessionId
    });

    if (!result.success) {
      return {
        agent: 'research-synthesis-agent',
        success: false,
        duration: result.duration,
        input: { projectId, sessionId },
        output: null,
        error: result.error,
        issues: [`调用失败: ${result.error}`]
      };
    }

    console.log('Research Synthesis Agent 返回数据:', JSON.stringify(result.data, null, 2).substring(0, 500));

    // 验证输出结构
    const requiredFields = [
      'synthesis',
      'synthesis.synthesized_insights',
      'synthesis.contradictions_or_gaps'
    ];
    
    const validationIssues = validateJsonStructure(result.data, requiredFields);
    issues.push(...validationIssues);

    // 检查洞察质量
    if (result.data.synthesis?.synthesized_insights) {
      const insights = result.data.synthesis.synthesized_insights;
      
      if (insights.length === 0) {
        issues.push('未生成任何研究洞察');
      } else {
        // 检查每个洞察的必需字段
        for (let i = 0; i < insights.length; i++) {
          const insight = insights[i];
          if (!insight.id) issues.push(`洞察 ${i + 1} 缺少 id`);
          if (!insight.category) issues.push(`洞察 ${i + 1} 缺少 category`);
          if (!insight.insight) issues.push(`洞察 ${i + 1} 缺少 insight`);
          if (!insight.recommended_usage) issues.push(`洞察 ${i + 1} 缺少 recommended_usage`);
        }
      }
    }

    return {
      agent: 'research-synthesis-agent',
      success: issues.length === 0,
      duration: Date.now() - startTime,
      input: { projectId, sessionId },
      output: {
        insights_count: result.data.synthesis?.synthesized_insights?.length || 0,
        gaps_count: result.data.synthesis?.contradictions_or_gaps?.length || 0
      },
      issues
    };
  } catch (error: any) {
    return {
      agent: 'research-synthesis-agent',
      success: false,
      duration: Date.now() - startTime,
      input: { projectId, sessionId },
      output: null,
      error: error.message,
      issues: [error.message]
    };
  }
}

// 测试 4: Structure Agent
async function testStructureAgent(projectId: string): Promise<TestResult> {
  console.log('\n========== 测试 Structure Agent ==========');
  const issues: string[] = [];
  const startTime = Date.now();
  
  try {
    const result = await invokeEdgeFunction('structure-agent', {
      project_id: projectId
    });

    if (!result.success) {
      return {
        agent: 'structure-agent',
        success: false,
        duration: result.duration,
        input: { project_id: projectId },
        output: null,
        error: result.error,
        issues: [`调用失败: ${result.error}`]
      };
    }

    console.log('Structure Agent 返回数据:', JSON.stringify(result.data, null, 2).substring(0, 500));

    // 验证输出结构
    const requiredFields = [
      'argument_outline',
      'argument_outline.argument_blocks',
      'argument_outline.coverage_check'
    ];
    
    const validationIssues = validateJsonStructure(result.data, requiredFields);
    issues.push(...validationIssues);

    // 检查结构质量
    if (result.data.argument_outline?.argument_blocks) {
      const blocks = result.data.argument_outline.argument_blocks;
      
      if (blocks.length === 0) {
        issues.push('未生成任何文章结构块');
      } else {
        // 检查每个块的必需字段
        for (let i = 0; i < blocks.length; i++) {
          const block = blocks[i];
          if (!block.block_id) issues.push(`结构块 ${i + 1} 缺少 block_id`);
          if (!block.block_type) issues.push(`结构块 ${i + 1} 缺少 block_type`);
          if (!block.title) issues.push(`结构块 ${i + 1} 缺少 title`);
          if (!block.derived_from || block.derived_from.length === 0) {
            issues.push(`结构块 ${i + 1} 缺少 derived_from（必须引用研究洞察）`);
          }
        }
      }
    }

    return {
      agent: 'structure-agent',
      success: issues.length === 0,
      duration: Date.now() - startTime,
      input: { project_id: projectId },
      output: {
        blocks_count: result.data.argument_outline?.argument_blocks?.length || 0
      },
      issues
    };
  } catch (error: any) {
    return {
      agent: 'structure-agent',
      success: false,
      duration: Date.now() - startTime,
      input: { project_id: projectId },
      output: null,
      error: error.message,
      issues: [error.message]
    };
  }
}

// 测试 5: Draft Agent
async function testDraftAgent(projectId: string): Promise<TestResult> {
  console.log('\n========== 测试 Draft Agent ==========');
  const issues: string[] = [];
  const startTime = Date.now();
  
  try {
    const result = await invokeEdgeFunction('draft-agent', {
      project_id: projectId
    });

    if (!result.success) {
      return {
        agent: 'draft-agent',
        success: false,
        duration: result.duration,
        input: { project_id: projectId },
        output: null,
        error: result.error,
        issues: [`调用失败: ${result.error}`]
      };
    }

    console.log('Draft Agent 返回数据:', JSON.stringify(result.data, null, 2).substring(0, 500));

    // 验证输出结构
    const requiredFields = [
      'draft_payload',
      'draft_payload.draft_blocks',
      'draft_payload.total_word_count',
      'draft_payload.global_coherence_score'
    ];
    
    const validationIssues = validateJsonStructure(result.data, requiredFields);
    issues.push(...validationIssues);

    // 检查草稿质量
    if (result.data.draft_payload?.draft_blocks) {
      const blocks = result.data.draft_payload.draft_blocks;
      
      if (blocks.length === 0) {
        issues.push('未生成任何草稿块');
      } else {
        // 检查每个块的必需字段
        for (let i = 0; i < blocks.length; i++) {
          const block = blocks[i];
          if (!block.block_id) issues.push(`草稿块 ${i + 1} 缺少 block_id`);
          if (!block.content || block.content.length < 50) {
            issues.push(`草稿块 ${i + 1} 内容不足（少于50字符）`);
          }
          if (!block.citations || block.citations.length === 0) {
            issues.push(`草稿块 ${i + 1} 缺少引用（必须引用研究资料）`);
          }
        }
      }
    }

    // 检查字数
    if (result.data.draft_payload?.total_word_count < 500) {
      issues.push('草稿总字数不足500字');
    }

    return {
      agent: 'draft-agent',
      success: issues.length === 0,
      duration: Date.now() - startTime,
      input: { project_id: projectId },
      output: {
        blocks_count: result.data.draft_payload?.draft_blocks?.length || 0,
        total_word_count: result.data.draft_payload?.total_word_count || 0,
        coherence_score: result.data.draft_payload?.global_coherence_score || 0
      },
      issues
    };
  } catch (error: any) {
    return {
      agent: 'draft-agent',
      success: false,
      duration: Date.now() - startTime,
      input: { project_id: projectId },
      output: null,
      error: error.message,
      issues: [error.message]
    };
  }
}

// 测试 6: Review Agent
async function testReviewAgent(projectId: string): Promise<TestResult> {
  console.log('\n========== 测试 Review Agent ==========');
  const issues: string[] = [];
  const startTime = Date.now();
  
  try {
    const result = await invokeEdgeFunction('review-agent', {
      project_id: projectId
    });

    if (!result.success) {
      return {
        agent: 'review-agent',
        success: false,
        duration: result.duration,
        input: { project_id: projectId },
        output: null,
        error: result.error,
        issues: [`调用失败: ${result.error}`]
      };
    }

    console.log('Review Agent 返回数据:', JSON.stringify(result.data, null, 2).substring(0, 500));

    // 验证输出结构
    const requiredFields = [
      'review_payload',
      'review_payload.logic_issues',
      'review_payload.citation_issues',
      'review_payload.style_issues',
      'review_payload.grammar_issues',
      'review_payload.overall_quality',
      'review_payload.pass'
    ];
    
    const validationIssues = validateJsonStructure(result.data, requiredFields);
    issues.push(...validationIssues);

    // 检查审校质量
    if (result.data.review_payload?.overall_quality) {
      const quality = result.data.review_payload.overall_quality;
      
      if (quality.overall_score === undefined || quality.overall_score === null) {
        issues.push('缺少总体评分');
      }
      if (quality.logic_score === undefined) issues.push('缺少逻辑评分');
      if (quality.citation_score === undefined) issues.push('缺少引用评分');
      if (quality.style_score === undefined) issues.push('缺少风格评分');
      if (quality.grammar_score === undefined) issues.push('缺少语法评分');
    }

    return {
      agent: 'review-agent',
      success: issues.length === 0,
      duration: Date.now() - startTime,
      input: { project_id: projectId },
      output: {
        total_issues: (result.data.review_payload?.logic_issues?.length || 0) +
                      (result.data.review_payload?.citation_issues?.length || 0) +
                      (result.data.review_payload?.style_issues?.length || 0) +
                      (result.data.review_payload?.grammar_issues?.length || 0),
        overall_score: result.data.review_payload?.overall_quality?.overall_score || 0,
        pass: result.data.review_payload?.pass || false
      },
      issues
    };
  } catch (error: any) {
    return {
      agent: 'review-agent',
      success: false,
      duration: Date.now() - startTime,
      input: { project_id: projectId },
      output: null,
      error: error.message,
      issues: [error.message]
    };
  }
}

// 主测试函数
async function runAllTests() {
  console.log('========================================');
  console.log('开始 Agent 集成测试');
  console.log('========================================\n');

  try {
    // 创建测试项目
    console.log('创建测试项目...');
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert({
        title: TEST_PROJECT.title,
        status: 'init'
      })
      .select()
      .single();

    if (projectError || !project) {
      throw new Error(`创建测试项目失败: ${projectError?.message}`);
    }

    const projectId = project.id;
    const userId = 'test-user-id'; // 需要替换为实际的测试用户ID
    const sessionId = `test-session-${Date.now()}`;

    console.log(`测试项目已创建: ${projectId}\n`);

    // 运行测试
    // 1. Brief Agent
    const briefResult = await testBriefAgent(projectId);
    testResults.push(briefResult);

    if (!briefResult.success) {
      console.error('❌ Brief Agent 测试失败，停止后续测试');
      return;
    }

    // 2. Research Retrieval Agent
    const retrievalResult = await testResearchRetrievalAgent(projectId, userId);
    testResults.push(retrievalResult);

    if (!retrievalResult.success) {
      console.error('❌ Research Retrieval Agent 测试失败，停止后续测试');
      return;
    }

    // 3. Research Synthesis Agent
    const synthesisResult = await testResearchSynthesisAgent(projectId, sessionId);
    testResults.push(synthesisResult);

    if (!synthesisResult.success) {
      console.error('❌ Research Synthesis Agent 测试失败，停止后续测试');
      return;
    }

    // 4. Structure Agent
    const structureResult = await testStructureAgent(projectId);
    testResults.push(structureResult);

    if (!structureResult.success) {
      console.error('❌ Structure Agent 测试失败，停止后续测试');
      return;
    }

    // 5. Draft Agent
    const draftResult = await testDraftAgent(projectId);
    testResults.push(draftResult);

    if (!draftResult.success) {
      console.error('❌ Draft Agent 测试失败，停止后续测试');
      return;
    }

    // 6. Review Agent
    const reviewResult = await testReviewAgent(projectId);
    testResults.push(reviewResult);

    // 清理测试数据
    console.log('\n清理测试数据...');
    await supabase.from('projects').delete().eq('id', projectId);

  } catch (error: any) {
    console.error('测试执行失败:', error);
  }

  // 输出测试报告
  console.log('\n========================================');
  console.log('测试报告');
  console.log('========================================\n');

  let allPassed = true;
  for (const result of testResults) {
    const status = result.success ? '✅ 通过' : '❌ 失败';
    console.log(`${result.agent}: ${status}`);
    console.log(`  耗时: ${result.duration}ms`);
    
    if (result.error) {
      console.log(`  错误: ${result.error}`);
    }
    
    if (result.issues.length > 0) {
      console.log(`  问题:`);
      result.issues.forEach(issue => console.log(`    - ${issue}`));
    }
    
    console.log('');

    if (!result.success) {
      allPassed = false;
    }
  }

  console.log('========================================');
  if (allPassed) {
    console.log('✅ 所有测试通过！');
  } else {
    console.log('❌ 部分测试失败，请检查上述问题');
  }
  console.log('========================================\n');
}

// 运行测试
runAllTests().catch(console.error);
