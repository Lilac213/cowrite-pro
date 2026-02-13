/**
 * New API 中转站测试脚本
 * 用于验证 New API 配置是否正确
 */

import https from 'https';
import http from 'http';

const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.newapi.pro';
const API_KEY = process.env.INTEGRATIONS_API_KEY || 'sk-mQnV4bKXYX2sbQnz5NMuZSa6spIDMJhV7xRSfHNtLHKfY6sf';

function makeRequest(url, options, data) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol === 'https:' ? https : http;
    
    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        ...options.headers,
      },
    };

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

async function testNewAPI() {
  console.log('========================================');
  console.log('New API 中转站测试');
  console.log('========================================\n');

  console.log('测试配置:');
  console.log(`  Base URL: ${OPENAI_BASE_URL}`);
  console.log(`  API Key: ${API_KEY.substring(0, 20)}...`);
  console.log('');

  const testCases = [
    {
      name: '测试 Gemini 2.0 Flash',
      model: 'gemini-2.0-flash-exp',
      prompt: '你好，请用一句话介绍你自己。',
    },
    {
      name: '测试 Gemini 1.5 Pro',
      model: 'gemini-1.5-pro',
      prompt: '请用一句话回答：1+1等于几？',
    },
  ];

  for (const testCase of testCases) {
    console.log(`\n========== ${testCase.name} ==========\n`);
    console.log(`模型: ${testCase.model}`);
    console.log(`提示: ${testCase.prompt}\n`);

    const startTime = Date.now();
    const normalizedBaseUrl = OPENAI_BASE_URL.endsWith('/v1') ? OPENAI_BASE_URL : `${OPENAI_BASE_URL}/v1`;
    const url = `${normalizedBaseUrl}/chat/completions`;

    try {
      const response = await makeRequest(
        url,
        {
          method: 'POST',
        },
        {
          model: testCase.model,
          messages: [
            {
              role: 'user',
              content: testCase.prompt,
            },
          ],
          temperature: 0.3,
          max_tokens: 100,
        }
      );

      const duration = Date.now() - startTime;

      if (response.status === 200) {
        console.log('✅ 测试成功');
        console.log(`耗时: ${duration}ms`);
        console.log(`响应: ${response.data.choices[0].message.content}`);
        
        if (response.data.usage) {
          console.log(`Token 使用:`);
          console.log(`  - Prompt: ${response.data.usage.prompt_tokens}`);
          console.log(`  - Completion: ${response.data.usage.completion_tokens}`);
          console.log(`  - Total: ${response.data.usage.total_tokens}`);
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

testNewAPI().catch(console.error);
