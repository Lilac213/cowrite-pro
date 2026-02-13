/**
 * 完整 Agent 流程测试
 * 测试所有 Agent：Brief -> Research Retrieval -> Research Synthesis -> Structure -> Draft -> Review
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

async function invokeFunction(functionName, payload) {
  const startTime = Date.now();
  
  const response = await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'apikey': SUPABASE_SERVICE_KEY,
    },
    body: JSON.stringify(payload),
  });
  
  const data = await response.json();
  const duration = Date.now() - startTime;
  
  return {
    success: response.ok,
    status: response.status,
    data,
    duration
  };
}

async function createTestProject() {
  const testEmail = `test-full-flow-${Date.now()}@example.com`;
  const testPassword = 'TestPassword123!';
  
  // 创建测试用户
  const createUserResponse = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'apikey': SUPABASE_SERVICE_KEY
    },
    body: JSON.stringify({
      email: testEmail,
      password: testPassword,
      email_confirm: true,
      user_metadata: { username: 'test-flow-user' }
    })
  });
  
  if (!createUserResponse.ok) {
    throw new Error('创建测试用户失败');
  }
  
  const userData = await createUserResponse.json();
  const testUserId = userData.id;
  
  // 创建测试项目
  const testProjectId = crypto.randomUUID();
  const projectResponse = await fetch(`${SUPABASE_URL}/rest/v1/projects`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'apikey': SUPABASE_SERVICE_KEY,
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({
      id: testProjectId,
      user_id: testUserId,
      title: 'Full Flow Test Project',
      status: 'init'
    })
  });
  
  if (!projectResponse.ok && projectResponse.status !== 409) {
    throw new Error('创建测试项目失败');
  }
  
  return { testProjectId, testUserId };
}

async function saveToDatabase(table, data) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'apikey': SUPABASE_SERVICE_KEY,
      'Prefer': 'return=minimal,resolution=merge-duplicates'
    },
    body: JSON.stringify(data)
  });
  return response.ok;
}

async function runFullTest() {
  console.log('========================================');
  console.log('完整 Agent 流程测试');
  console.log('========================================\n');
  
  console.log('测试环境:');
  console.log(`  Supabase URL: ${SUPABASE_URL}`);
  console.log(`  API Key: ${SUPABASE_SERVICE_KEY ? '✅ 已配置' : '❌ 未配置'}`);
  console.log('');
  
  // 准备测试数据
  console.log('========== 准备测试数据 ==========\n');
  const { testProjectId, testUserId } = await createTestProject();
  console.log(`测试项目 ID: ${testProjectId}`);
  console.log(`测试用户 ID: ${testUserId}\n`);
  
  const results = {
    brief: null,
    researchRetrieval: null,
    researchSynthesis: null,
    structure: null,
    draft: null,
    review: null
  };
  
  // ========== 1. Brief Agent ==========
  console.log('========== 1. Brief Agent ==========\n');
  
  const briefResult = await invokeFunction('brief-agent', {
    project_id: testProjectId,
    topic: 'AI Agent 商业化应用',
    user_input: '我想写一篇关于 AI Agent 如何实现商业化的文章，包括商业模式、用户获取策略等',
    context: '目标读者是创业者和产品经理'
  });
  
  results.brief = briefResult;
  
  if (briefResult.success) {
    console.log(`✅ Brief Agent 成功 (${briefResult.duration}ms)`);
    console.log(`   主题: ${briefResult.data.writing_brief?.topic}`);
    console.log(`   洞察点: ${briefResult.data.writing_brief?.confirmed_insights?.length} 个`);
  } else {
    console.log(`❌ Brief Agent 失败: ${JSON.stringify(briefResult.data)}`);
    console.log('\n⚠️ 后续测试无法继续，终止测试');
    return results;
  }
  console.log('');
  
  // ========== 2. Research Retrieval Agent ==========
  console.log('========== 2. Research Retrieval Agent ==========\n');
  
  const retrievalResult = await invokeFunction('research-retrieval-agent', {
    requirementsDoc: {
      topic: briefResult.data.writing_brief?.topic,
      confirmed_insights: briefResult.data.writing_brief?.confirmed_insights
    },
    projectId: testProjectId,
    userId: testUserId
  });
  
  results.researchRetrieval = retrievalResult;
  
  if (retrievalResult.success) {
    const actualData = retrievalResult.data?.data || retrievalResult.data;
    console.log(`✅ Research Retrieval Agent 成功 (${retrievalResult.duration}ms)`);
    console.log(`   学术资料: ${actualData?.academic_sources?.length || 0} 条`);
    console.log(`   新闻资料: ${actualData?.news_sources?.length || 0} 条`);
    console.log(`   网页资料: ${actualData?.web_sources?.length || 0} 条`);
  } else {
    console.log(`❌ Research Retrieval Agent 失败: ${JSON.stringify(retrievalResult.data)}`);
  }
  console.log('');
  
  // ========== 3. Research Synthesis Agent ==========
  console.log('========== 3. Research Synthesis Agent ==========\n');
  
  // 准备 Research Synthesis 输入
  const retrievalData = retrievalResult.data?.data || retrievalResult.data;
  const rawMaterials = [
    ...(retrievalData?.academic_sources || []),
    ...(retrievalData?.news_sources || []),
    ...(retrievalData?.web_sources || [])
  ].map(source => ({
    title: source.title || 'Untitled',
    source: source.source_type || 'web',
    source_url: source.url || source.source_url,
    content: source.content || source.summary || source.abstract || ''
  }));
  
  const synthesisResult = await invokeFunction('research-synthesis-agent', {
    input: {
      writing_requirements: {
        topic: briefResult.data.writing_brief?.topic,
        target_audience: briefResult.data.writing_brief?.requirement_meta?.target_audience,
        key_points: briefResult.data.writing_brief?.confirmed_insights
      },
      raw_materials: rawMaterials.length > 0 ? rawMaterials : [
        {
          title: 'AI Agent Commercialization Overview',
          source: 'web',
          content: 'AI Agent 商业化需要考虑用户画像、商业模式设计和多渠道营销策略。'
        }
      ]
    },
    projectId: testProjectId
  });
  
  results.researchSynthesis = synthesisResult;
  
  if (synthesisResult.success) {
    console.log(`✅ Research Synthesis Agent 成功 (${synthesisResult.duration}ms)`);
    console.log(`   洞察数量: ${synthesisResult.data?.synthesis?.synthesized_insights?.length || 0}`);
    console.log(`   知识缺口: ${synthesisResult.data?.synthesis?.contradictions_or_gaps?.length || 0}`);
    
    // 保存洞察到数据库（Structure Agent 需要）
    const insights = synthesisResult.data?.synthesis?.synthesized_insights || [];
    for (const insight of insights) {
      await saveToDatabase('synthesized_insights', {
        project_id: testProjectId,
        category: insight.category || 'general',
        content: insight.insight || insight.content || '',
        evidence_strength: 'medium',
        citability: 'paraphrase',
        user_decision: 'confirmed',
        confidence_score: 0.8
      });
    }
    console.log(`   已保存 ${insights.length} 条洞察到数据库`);
  } else {
    console.log(`❌ Research Synthesis Agent 失败: ${JSON.stringify(synthesisResult.data)}`);
  }
  console.log('');
  
  // ========== 4. Structure Agent ==========
  console.log('========== 4. Structure Agent ==========\n');
  
  const structureResult = await invokeFunction('structure-agent', {
    project_id: testProjectId
  });
  
  results.structure = structureResult;
  
  if (structureResult.success) {
    console.log(`✅ Structure Agent 成功 (${structureResult.duration}ms)`);
    const structure = structureResult.data?.structure || structureResult.data?.argument_outline;
    console.log(`   结构段落数: ${structure?.paragraphs?.length || structure?.sections?.length || 'N/A'}`);
  } else {
    console.log(`❌ Structure Agent 失败: ${JSON.stringify(structureResult.data)}`);
    console.log('\n⚠️ 后续测试无法继续，终止测试');
    return results;
  }
  console.log('');
  
  // ========== 5. Draft Agent ==========
  console.log('========== 5. Draft Agent ==========\n');
  
  const draftResult = await invokeFunction('draft-agent', {
    project_id: testProjectId
  });
  
  results.draft = draftResult;
  
  if (draftResult.success) {
    console.log(`✅ Draft Agent 成功 (${draftResult.duration}ms)`);
    const draft = draftResult.data?.draft || draftResult.data;
    console.log(`   段落数: ${draft?.paragraphs?.length || draft?.sections?.length || 'N/A'}`);
    const totalWords = draft?.paragraphs?.reduce((sum, p) => sum + (p.content?.length || 0), 0) || 0;
    console.log(`   总字数: 约 ${totalWords} 字`);
  } else {
    console.log(`❌ Draft Agent 失败: ${JSON.stringify(draftResult.data)}`);
    console.log('\n⚠️ 后续测试无法继续，终止测试');
    return results;
  }
  console.log('');
  
  // ========== 6. Review Agent ==========
  console.log('========== 6. Review Agent ==========\n');
  
  const reviewResult = await invokeFunction('review-agent', {
    project_id: testProjectId
  });
  
  results.review = reviewResult;
  
  if (reviewResult.success) {
    console.log(`✅ Review Agent 成功 (${reviewResult.duration}ms)`);
    const review = reviewResult.data?.review || reviewResult.data;
    console.log(`   整体评分: ${review?.overall_score || review?.coherence_score || 'N/A'}`);
    console.log(`   问题数量: ${review?.issues?.length || 0}`);
    console.log(`   改进建议: ${review?.suggestions?.length || 0}`);
  } else {
    console.log(`❌ Review Agent 失败: ${JSON.stringify(reviewResult.data)}`);
  }
  console.log('');
  
  // ========== 汇总 ==========
  console.log('========================================');
  console.log('测试汇总');
  console.log('========================================\n');
  
  const agentNames = ['Brief', 'Research Retrieval', 'Research Synthesis', 'Structure', 'Draft', 'Review'];
  const agentResults = [results.brief, results.researchRetrieval, results.researchSynthesis, results.structure, results.draft, results.review];
  
  agentNames.forEach((name, i) => {
    const result = agentResults[i];
    if (result) {
      const status = result.success ? '✅' : '❌';
      console.log(`${status} ${name} Agent: ${result.success ? `成功 (${result.duration}ms)` : '失败'}`);
    } else {
      console.log(`⏭️ ${name} Agent: 跳过`);
    }
  });
  
  const successCount = agentResults.filter(r => r?.success).length;
  console.log(`\n总计: ${successCount}/6 个 Agent 测试通过`);
  
  return results;
}

runFullTest().catch(error => {
  console.error('测试执行失败:', error);
  process.exit(1);
});
