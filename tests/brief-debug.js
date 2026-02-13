const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function testBriefAgent() {
  console.log('========== Brief Agent 详细诊断 ==========\n');
  
  const payload = {
    project_id: 'test-project',
    topic: 'AI Agent 商业化',
    user_input: '我想写一篇关于 AI Agent 如何实现商业化的文章',
    context: ''
  };
  
  console.log('请求参数:', JSON.stringify(payload, null, 2));
  console.log('\n发送请求...');
  
  try {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/brief-agent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'apikey': SUPABASE_KEY,
        },
        body: JSON.stringify(payload),
      }
    );
    
    console.log('响应状态:', response.status);
    const data = await response.json();
    console.log('\n完整响应:');
    console.log(JSON.stringify(data, null, 2));
    
    if (data.details) {
      console.log('\n错误详情类型:', typeof data.details);
      if (typeof data.details === 'object') {
        console.log('错误详情内容:', JSON.stringify(data.details, null, 2));
      }
    }
  } catch (error) {
    console.error('请求失败:', error);
  }
}

testBriefAgent();
