/**
 * New API 详细测试脚本
 * 测试不同的 URL 和认证方式
 */

import https from 'https';
import http from 'http';

const API_KEY = 'sk-mQnV4bKXYX2sbQnz5NMuZSa6spIDMJhV7xRSfHNtLHKfY6sf';

const testConfigs = [
  {
    name: '配置 1: api.newapi.pro/v1/chat/completions',
    baseUrl: 'https://api.newapi.pro',
    path: '/v1/chat/completions',
  },
  {
    name: '配置 2: api.newapi.pro/chat/completions (无 /v1)',
    baseUrl: 'https://api.newapi.pro',
    path: '/chat/completions',
  },
  {
    name: '配置 3: newapi.pro/v1/chat/completions',
    baseUrl: 'https://newapi.pro',
    path: '/v1/chat/completions',
  },
  {
    name: '配置 4: api.newapi.pro/v1/models (测试模型列表)',
    baseUrl: 'https://api.newapi.pro',
    path: '/v1/models',
  },
];

function makeRequest(baseUrl, path, method = 'POST', data = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(baseUrl);
    const protocol = urlObj.protocol === 'https:' ? https : http;
    
    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
    };

    console.log(`  请求 URL: ${baseUrl}${path}`);
    console.log(`  请求方法: ${method}`);
    console.log(`  Authorization: Bearer ${API_KEY.substring(0, 20)}...`);

    const req = protocol.request(reqOptions, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data,
          });
        } catch (error) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: body,
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function testAllConfigs() {
  console.log('========================================');
  console.log('New API 详细测试');
  console.log('========================================\n');

  console.log(`API Key: ${API_KEY.substring(0, 20)}...`);
  console.log('');

  for (const config of testConfigs) {
    console.log(`\n========== ${config.name} ==========\n`);

    const startTime = Date.now();

    try {
      let response;
      
      if (config.path.includes('/models')) {
        // 测试模型列表（GET 请求）
        response = await makeRequest(config.baseUrl, config.path, 'GET');
      } else {
        // 测试聊天（POST 请求）
        response = await makeRequest(
          config.baseUrl,
          config.path,
          'POST',
          {
            model: 'gemini-2.0-flash-exp',
            messages: [
              {
                role: 'user',
                content: '你好',
              },
            ],
            temperature: 0.3,
            max_tokens: 50,
          }
        );
      }

      const duration = Date.now() - startTime;

      if (response.status === 200) {
        console.log('✅ 测试成功');
        console.log(`耗时: ${duration}ms`);
        
        if (response.data.choices) {
          console.log(`响应: ${response.data.choices[0].message.content}`);
        } else if (response.data.data) {
          console.log(`可用模型数量: ${response.data.data.length}`);
          console.log(`前 5 个模型: ${response.data.data.slice(0, 5).map(m => m.id).join(', ')}`);
        }
      } else {
        console.log('❌ 测试失败');
        console.log(`状态码: ${response.status}`);
        console.log(`错误信息: ${JSON.stringify(response.data, null, 2)}`);
      }
    } catch (error) {
      console.log('❌ 测试失败');
      console.log(`错误: ${error.message}`);
    }
  }

  console.log('\n========================================');
  console.log('测试完成');
  console.log('========================================\n');
}

testAllConfigs().catch(console.error);
