/**
 * New API 测试脚本 - 使用正确的模型名称
 */

import https from 'https';
import http from 'http';

const API_KEY = 'sk-mQnV4bKXYX2sbQnz5NMuZSa6spIDMJhV7xRSfHNtLHKfY6sf';
const BASE_URL = 'https://api.newapi.pro';
const MODEL = 'gemini-3-pro-preview';

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
  console.log('New API 测试 - 使用正确的模型名称');
  console.log('========================================\n');

  console.log('测试配置:');
  console.log(`  Base URL: ${BASE_URL}`);
  console.log(`  API Key: ${API_KEY.substring(0, 20)}...`);
  console.log(`  模型: ${MODEL}`);
  console.log('');

  console.log('========== 测试 1: 模型列表 ==========\n');

  try {
    const modelsResponse = await makeRequest(
      `${BASE_URL}/v1/models`,
      { method: 'GET' }
    );

    if (modelsResponse.status === 200) {
      console.log('✅ 获取模型列表成功');
      console.log(`可用模型数量: ${modelsResponse.data.data.length}`);
      
      const geminiModels = modelsResponse.data.data.filter(m => m.id.includes('gemini'));
      console.log(`\nGemini 模型:`);
      geminiModels.forEach(m => {
        console.log(`  - ${m.id}`);
      });
    } else {
      console.log('❌ 获取模型列表失败');
      console.log(`状态码: ${modelsResponse.status}`);
      console.log(`错误: ${JSON.stringify(modelsResponse.data, null, 2)}`);
    }
  } catch (error) {
    console.log('❌ 请求失败');
    console.log(`错误: ${error.message}`);
  }

  console.log('\n========== 测试 2: Chat Completions ==========\n');

  const startTime = Date.now();

  try {
    const response = await makeRequest(
      `${BASE_URL}/v1/chat/completions`,
      {
        method: 'POST',
      },
      {
        model: MODEL,
        messages: [
          {
            role: 'user',
            content: '你好，请用一句话介绍你自己。',
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
        console.log(`\nToken 使用:`);
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

  console.log('\n========================================');
  console.log('测试完成');
  console.log('========================================\n');
}

testNewAPI().catch(console.error);
