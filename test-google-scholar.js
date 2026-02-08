// Google Scholar API 测试脚本
// 运行方式: node test-google-scholar.js

const SUPABASE_URL = 'https://app-9bwpferlujnl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFwcC05YndwZmVybHVqbmwiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTczODc0NTI3NiwiZXhwIjoyMDU0MzIxMjc2fQ.Iu-Uc8Yx6Uh9Oj3ynCJjBmBXvPGJVLfJfBPPXMELKLo';

async function testGoogleScholar() {
  console.log('========== Google Scholar API 测试 ==========\n');
  
  const testQuery = 'AI Agent commercialization';
  console.log(`测试查询: "${testQuery}"\n`);
  
  try {
    console.log('正在调用 Edge Function...');
    const response = await fetch(`${SUPABASE_URL}/functions/v1/google-scholar-search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({
        query: testQuery,
        yearStart: '2020'
      })
    });

    console.log(`响应状态: ${response.status} ${response.statusText}\n`);

    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ API 调用成功！\n');
      console.log(`找到 ${data.papers?.length || 0} 篇论文`);
      console.log(`总结果数: ${data.total || 0}\n`);
      
      if (data.papers && data.papers.length > 0) {
        console.log('前 3 篇论文:');
        data.papers.slice(0, 3).forEach((paper, index) => {
          console.log(`\n${index + 1}. ${paper.title}`);
          console.log(`   作者: ${paper.authors}`);
          console.log(`   年份: ${paper.year}`);
          console.log(`   引用: ${paper.citations}`);
          console.log(`   链接: ${paper.url}`);
        });
      }
    } else {
      console.log('❌ API 调用失败\n');
      console.log('错误信息:', data.error || JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.log('❌ 请求失败\n');
    console.error('错误:', error.message);
  }
  
  console.log('\n========== 测试完成 ==========');
}

testGoogleScholar();
