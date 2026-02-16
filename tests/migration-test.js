/**
 * 迁移和自建API综合测试
 */

import http from 'http';
import https from 'https';

const API_SERVER_URL = process.env.API_SERVER_URL || 'http://localhost:3000';
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.newapi.pro';
const API_KEY = process.env.INTEGRATIONS_API_KEY || 'sk-mQnV4bKXYX2sbQnz5NMuZSa6spIDMJhV7xRSfHNtLHKfY6sf';

function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol === 'https:' ? https : http;
    const req = protocol.request({
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function testAPIServer() {
  console.log('\n=== 测试自建API服务器 ===\n');
  
  try {
    const res = await request(`${API_SERVER_URL}/health`);
    console.log(res.status === 200 ? '✅ 健康检查通过' : `❌ 健康检查失败: ${res.status}`);
    
    const streamRes = await request(`${API_SERVER_URL}/api/search/stream`);
    console.log(streamRes.status === 200 ? '✅ 流式搜索端点可用' : `❌ 流式搜索端点失败: ${streamRes.status}`);
  } catch (err) {
    console.log(`❌ API服务器连接失败: ${err.message}`);
  }
}

async function testNewAPI() {
  console.log('\n=== 测试New API中转站 ===\n');
  
  const url = `${OPENAI_BASE_URL}/v1/chat/completions`;
  const body = JSON.stringify({
    model: 'gemini-2.0-flash-exp',
    messages: [{ role: 'user', content: '测试' }],
    max_tokens: 10
  });
  
  try {
    const res = await request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body
    });
    
    console.log(res.status === 200 ? '✅ New API调用成功' : `❌ New API调用失败: ${res.status}`);
  } catch (err) {
    console.log(`❌ New API连接失败: ${err.message}`);
  }
}

async function runTests() {
  console.log('========================================');
  console.log('迁移和API测试');
  console.log('========================================');
  
  await testAPIServer();
  await testNewAPI();
  
  console.log('\n========================================');
  console.log('测试完成');
  console.log('========================================\n');
}

runTests().catch(console.error);
