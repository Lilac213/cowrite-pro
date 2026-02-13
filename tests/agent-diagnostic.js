/**
 * Agent 详细诊断测试
 * 用于检查每个 Agent 的实际运行状态和配置
 */

import https from 'https';
import http from 'http';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

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

async function createTestProject() {
  const testEmail = 'test-agent@example.com';
  const testPassword = 'TestPassword123!';
  let testUserId = null;
  const testProjectId = '00000000-0000-0000-0000-000000000002';
  
  try {
    // 使用 Auth Admin API 创建测试用户
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
        user_metadata: {
          username: 'test-agent-user'
        }
      })
    });
    
    if (createUserResponse.ok) {
      const userData = await createUserResponse.json();
      testUserId = userData.id;
      console.log(`创建测试用户成功: ${testUserId}`);
    } else {
      const errorData = await createUserResponse.json();
      // 如果用户已存在，尝试获取用户 ID
      if (errorData.message?.includes('already')) {
        // 用户已存在，获取用户列表找到 ID
        const listUsersResponse = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?email=${testEmail}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'apikey': SUPABASE_SERVICE_KEY
          }
        });
        
        if (listUsersResponse.ok) {
          const listData = await listUsersResponse.json();
          if (listData.users && listData.users.length > 0) {
            testUserId = listData.users[0].id;
            console.log(`使用已存在的测试用户: ${testUserId}`);
          }
        }
      } else {
        console.log(`创建用户失败: ${JSON.stringify(errorData)}`);
      }
    }
    
    if (!testUserId) {
      console.log('无法获取测试用户 ID，使用默认 ID');
      return null;
    }
    
    // 创建测试项目
    const projectResponse = await fetch(`${SUPABASE_URL}/rest/v1/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'apikey': SUPABASE_SERVICE_KEY,
        'Prefer': 'resolution=merge-duplicates,return=minimal'
      },
      body: JSON.stringify({
        id: testProjectId,
        user_id: testUserId,
        title: 'Test Project for Agent Diagnostic',
        status: 'init'
      })
    });
    
    console.log(`项目创建状态: ${projectResponse.status}`);
    
    if (projectResponse.ok || projectResponse.status === 409) {
      return testProjectId;
    }
    
    return null;
    
  } catch (error) {
    console.log(`创建测试数据时出错: ${error.message}`);
    return null;
  }
}

async function diagnose() {
  console.log('========================================');
  console.log('Agent 详细诊断测试');
  console.log('========================================\n');
  
  console.log('测试环境:');
  console.log(`  Supabase URL: ${SUPABASE_URL}`);
  console.log(`  API Key 配置: ${SUPABASE_SERVICE_KEY ? '✅ 已配置' : '❌ 未配置'}`);
  console.log('');
  
  // 创建测试用户和项目
  console.log('========== 准备测试数据 ==========\n');
  const testProjectId = await createTestProject();
  
  if (!testProjectId) {
    console.log('⚠️ 无法创建测试项目，跳过 Brief Agent 测试');
    console.log('提示：请确保使用 Service Role Key 而非 Anon Key\n');
  } else {
    console.log(`测试项目 ID: ${testProjectId}`);
    console.log('');
  }
  
  // 测试 1: Brief Agent 详细诊断
  console.log('========== 测试 1: Brief Agent 详细诊断 ==========\n');
  
  if (!testProjectId) {
    console.log('⏭️ 跳过 Brief Agent 测试（需要有效的项目 ID）\n');
  } else {
  
  const briefPayload = {
    project_id: testProjectId,
    topic: 'AI Agent 在企业中的应用',
    user_input: '我想写一篇关于AI Agent在企业中的应用案例的文章',
    context: '目标读者是产品经理'
  };
  
  console.log('发送请求...');
  const briefStart = Date.now();
  
  try {
    const briefResult = await invokeFunction('brief-agent', briefPayload);
    const briefDuration = Date.now() - briefStart;
    
    console.log(`\n响应状态: ${briefResult.status}`);
    console.log(`响应时间: ${briefDuration}ms`);
    
    if (briefResult.success) {
      console.log('\n✅ Brief Agent 调用成功');
      console.log('\n返回数据结构:');
      console.log(JSON.stringify(briefResult.data, null, 2).substring(0, 1000));
      
      // 检查关键字段
      const hasWritingBrief = briefResult.data.writing_brief !== undefined;
      const hasTopic = briefResult.data.writing_brief?.topic !== undefined;
      const hasInsights = briefResult.data.writing_brief?.confirmed_insights !== undefined;
      const hasMeta = briefResult.data.writing_brief?.requirement_meta !== undefined;
      
      console.log('\n字段检查:');
      console.log(`  writing_brief: ${hasWritingBrief ? '✅' : '❌'}`);
      console.log(`  topic: ${hasTopic ? '✅' : '❌'}`);
      console.log(`  confirmed_insights: ${hasInsights ? '✅' : '❌'}`);
      console.log(`  requirement_meta: ${hasMeta ? '✅' : '❌'}`);
      
    } else {
      console.log('\n❌ Brief Agent 调用失败');
      console.log('\n错误详情:');
      console.log(JSON.stringify(briefResult.data, null, 2));
    }
  } catch (error) {
    console.log(`\n❌ Brief Agent 异常: ${error.message}`);
  }
  } // end of else for testProjectId
  
  // 测试 2: Research Retrieval Agent 详细诊断
  console.log('\n\n========== 测试 2: Research Retrieval Agent 详细诊断 ==========\n');
  
  const retrievalPayload = {
    requirementsDoc: {
      主题: 'AI Agent 商业化应用',
      关键要点: ['商业化落地', '用户获取']
    },
    projectId: `diagnostic-test-${Date.now()}`,
    userId: 'test-user'
  };
  
  console.log('发送请求...');
  const retrievalStart = Date.now();
  
  try {
    const retrievalResult = await invokeFunction('research-retrieval-agent', retrievalPayload);
    const retrievalDuration = Date.now() - retrievalStart;
    
    console.log(`\n响应状态: ${retrievalResult.status}`);
    console.log(`响应时间: ${retrievalDuration}ms`);
    
    if (retrievalResult.success) {
      console.log('\n✅ Research Retrieval Agent 调用成功');
      
      const actualData = retrievalResult.data?.data || retrievalResult.data;
      
      console.log('\n返回数据结构:');
      console.log('  search_summary:', actualData?.search_summary ? '✅ 存在' : '❌ 缺失');
      console.log('  academic_sources:', actualData?.academic_sources?.length || 0, '条');
      console.log('  news_sources:', actualData?.news_sources?.length || 0, '条');
      console.log('  web_sources:', actualData?.web_sources?.length || 0, '条');
      console.log('  stats:', retrievalResult.data?.stats);
      
      if (actualData?.search_summary) {
        console.log('\nsearch_summary 内容:');
        console.log(JSON.stringify(actualData.search_summary, null, 2));
      }
      
    } else {
      console.log('\n❌ Research Retrieval Agent 调用失败');
      console.log('\n错误详情:');
      console.log(JSON.stringify(retrievalResult.data, null, 2));
    }
  } catch (error) {
    console.log(`\n❌ Research Retrieval Agent 异常: ${error.message}`);
  }
  
  // 测试 3: Research Synthesis Agent 详细诊断
  console.log('\n\n========== 测试 3: Research Synthesis Agent 详细诊断 ==========\n');
  
  const synthesisPayload = {
    input: {
      writing_requirements: {
        topic: 'AI Agent 商业化应用',
        target_audience: '产品经理',
        key_points: ['商业化落地', '用户获取']
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
  
  console.log('发送请求...');
  const synthesisStart = Date.now();
  
  try {
    const synthesisResult = await invokeFunction('research-synthesis-agent', synthesisPayload);
    const synthesisDuration = Date.now() - synthesisStart;
    
    console.log(`\n响应状态: ${synthesisResult.status}`);
    console.log(`响应时间: ${synthesisDuration}ms`);
    
    if (synthesisResult.success) {
      console.log('\n✅ Research Synthesis Agent 调用成功');
      
      console.log('\n返回数据结构:');
      console.log('  thought:', synthesisResult.data?.thought ? '✅ 存在' : '❌ 缺失');
      console.log('  synthesis:', synthesisResult.data?.synthesis ? '✅ 存在' : '❌ 缺失');
      console.log('  insights_count:', synthesisResult.data?.synthesis?.synthesized_insights?.length || 0);
      console.log('  gaps_count:', synthesisResult.data?.synthesis?.contradictions_or_gaps?.length || 0);
      
      if (synthesisResult.data?.synthesis?.synthesized_insights) {
        console.log('\n洞察列表:');
        synthesisResult.data.synthesis.synthesized_insights.forEach((insight, i) => {
          console.log(`  ${i + 1}. [${insight.category}] ${insight.insight.substring(0, 50)}...`);
        });
      }
      
    } else {
      console.log('\n❌ Research Synthesis Agent 调用失败');
      console.log('\n错误详情:');
      console.log(JSON.stringify(synthesisResult.data, null, 2));
    }
  } catch (error) {
    console.log(`\n❌ Research Synthesis Agent 异常: ${error.message}`);
  }
  
  console.log('\n\n========================================');
  console.log('诊断完成');
  console.log('========================================\n');
}

diagnose().catch(error => {
  console.error('诊断执行失败:', error);
  process.exit(1);
});
