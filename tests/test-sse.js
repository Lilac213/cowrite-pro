/**
 * SSE (Server-Sent Events) 测试
 */

import http from 'http';

const API_SERVER_URL = process.env.API_SERVER_URL || 'http://localhost:3000';

function testSSE() {
  return new Promise((resolve, reject) => {
    const url = new URL(`${API_SERVER_URL}/api/search/stream`);
    let eventCount = 0;
    
    console.log(`连接到: ${url.href}\n`);
    
    const req = http.get({
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname,
      headers: {
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache'
      }
    }, (res) => {
      console.log(`状态码: ${res.statusCode}`);
      console.log(`Content-Type: ${res.headers['content-type']}\n`);
      
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      
      let buffer = '';
      
      res.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n\n');
        buffer = lines.pop();
        
        lines.forEach(line => {
          if (line.startsWith('data: ')) {
            eventCount++;
            const data = line.slice(6);
            console.log(`[事件 ${eventCount}] ${data}`);
            
            try {
              const parsed = JSON.parse(data);
              console.log(`  ├─ stage: ${parsed.stage}`);
              console.log(`  └─ message: ${parsed.message}\n`);
            } catch (e) {
              console.log(`  └─ 原始数据\n`);
            }
          }
        });
      });
      
      res.on('end', () => {
        console.log(`\n连接关闭，共接收 ${eventCount} 个事件`);
        resolve(eventCount);
      });
    });
    
    req.on('error', reject);
    
    setTimeout(() => {
      req.destroy();
      resolve(eventCount);
    }, 5000);
  });
}

async function runTest() {
  console.log('========================================');
  console.log('SSE 流式传输测试');
  console.log('========================================\n');
  
  try {
    const count = await testSSE();
    console.log(count > 0 ? '\n✅ SSE测试成功' : '\n⚠️ 未接收到事件');
  } catch (err) {
    console.log(`\n❌ SSE测试失败: ${err.message}`);
  }
  
  console.log('\n========================================');
  console.log('测试完成');
  console.log('========================================\n');
}

runTest().catch(console.error);
