import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      coreThesis,
      currentBlock,
      previousParagraph,
      relationToPrevious,
      newInformation,
      referenceMaterials,
      personalMaterials,
      knowledgeBase,
    } = await req.json();

    if (!coreThesis || !currentBlock) {
      return new Response(
        JSON.stringify({ error: '缺少核心论点或当前论证块信息' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('INTEGRATIONS_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'API密钥未配置' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 构建参考内容字符串
    let refContent = '';
    if (referenceMaterials && referenceMaterials.length > 0) {
      refContent = referenceMaterials.map((item: any) => `${item.title}: ${item.content?.substring(0, 200) || ''}`).join('\n');
    }

    let personalContent = '';
    if (personalMaterials && personalMaterials.length > 0) {
      personalContent = personalMaterials.map((item: any) => `${item.title}: ${item.content?.substring(0, 200) || ''}`).join('\n');
    }

    let knowledgeContent = '';
    if (knowledgeBase && knowledgeBase.length > 0) {
      knowledgeContent = knowledgeBase.map((item: any) => `${item.title}: ${item.content?.substring(0, 200) || ''}`).join('\n');
    }

    // 使用固定的prompt（不能改）
    const prompt = `你是写作系统中的【段落级推理模块】。
你只负责生成"段落的论证结构"，而不是正文。

【文章级约束】

核心论点：${coreThesis}
当前段落所属论证块：${currentBlock.title}
该论证块的论证任务：${currentBlock.description}

【段落关系信息】

上一段完成的论证任务：${previousParagraph || '无（这是第一段）'}
当前段与上一段的关系：${relationToPrevious || '引入'}
（承接 / 递进 / 转折 / 因果 / 举例 / 总结）
当前段新增的信息是什么：${newInformation || '待确定'}

【输入素材】

参考内容（如有）：${refContent || '无'}
作者个人素材（如有）：${personalContent || '无'}
检索资料摘要（如有）：${knowledgeContent || '无'}

【你的任务】
按以下顺序输出段落结构：

input_assumption（承接前文的前提）
core_claim（本段要证明的核心主张）
sub_claims（1–3 条分论据）
output_state（为下一段铺垫的逻辑出口）

【输出格式】
input_assumption：
core_claim：

sub_claim 1：
sub_claim 2：
sub_claim 3（如有）：
output_state：

【约束】

不生成完整句段
不引入案例、数据
所有内容必须服务于文章级论证块`;

    const response = await fetch('https://app-9bwpferlujnl-api-VaOwP8E7dJqa.gateway.appmedo.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Gateway-Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }]
          }
        ]
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(
        JSON.stringify({ error: `API请求失败: ${errorText}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 读取流式响应
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let fullText = '';

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const jsonData = JSON.parse(line.slice(6));
              if (jsonData.candidates && jsonData.candidates[0]?.content?.parts) {
                const text = jsonData.candidates[0].content.parts[0]?.text || '';
                fullText += text;
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }
    }

    // 解析返回的结构化内容
    const lines = fullText.split('\n').filter(line => line.trim());
    const structure: any = {
      input_assumption: '',
      core_claim: '',
      sub_claims: [],
      output_state: '',
    };

    let currentField = '';
    for (const line of lines) {
      if (line.startsWith('input_assumption：') || line.startsWith('input_assumption:')) {
        currentField = 'input_assumption';
        structure.input_assumption = line.split(/[：:]/)[1]?.trim() || '';
      } else if (line.startsWith('core_claim：') || line.startsWith('core_claim:')) {
        currentField = 'core_claim';
        structure.core_claim = line.split(/[：:]/)[1]?.trim() || '';
      } else if (line.match(/sub_claim\s*\d+[：:]/)) {
        currentField = 'sub_claims';
        const claim = line.split(/[：:]/)[1]?.trim();
        if (claim) structure.sub_claims.push(claim);
      } else if (line.startsWith('output_state：') || line.startsWith('output_state:')) {
        currentField = 'output_state';
        structure.output_state = line.split(/[：:]/)[1]?.trim() || '';
      } else if (currentField && line.trim() && !line.match(/^【.*】$/)) {
        // 继续追加到当前字段（排除标题行）
        if (currentField === 'sub_claims') {
          if (structure.sub_claims.length > 0) {
            structure.sub_claims[structure.sub_claims.length - 1] += ' ' + line.trim();
          }
        } else {
          structure[currentField] += ' ' + line.trim();
        }
      }
    }

    return new Response(
      JSON.stringify(structure),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Generate paragraph reasoning error:', error);
    const errorMessage = error instanceof Error ? error.message : '生成失败，请重试';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
