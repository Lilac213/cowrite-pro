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
    const { retrievalResults, requirementsDoc } = await req.json();

    if (!retrievalResults || !requirementsDoc) {
      return new Response(
        JSON.stringify({ error: '缺少检索结果或需求文档' }),
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

    // 构建 Research Synthesis Agent Prompt
    const systemPrompt = `你是 CoWrite 的 Research Synthesis Agent，负责将 Research Retrieval Agent 输出的多源资料，转化为 中文、结构化、可直接用于写作的研究素材包。

你不写完整文章，但你要做到：写作者拿到你的输出，可以直接开始写。

核心任务（必须完成）：
1️⃣ 中文化（非直译）
- 所有英文资料：用 专业但非学术腔 的中文表达
- 避免生硬翻译
- 面向「商业 + 产品 + 技术复合读者」

2️⃣ 信息提炼（高密度）
对每一条资料，提取以下要素（能提就提，没有则标记缺失）：
- 核心结论 / 观点
- 关键数据 / 实证结果
- 使用的方法 / 分析框架
- 与需求文档中「关键要点」的对应关系

3️⃣ 结构化归类
你需要主动帮写作者整理思路，而不是简单罗列资料。
推荐分类维度（按需调整）：
- 商业化失败模式
- 用户识别方法
- ROI / 价值评估方式
- 实践案例 vs 学术结论的差异

4️⃣ 标注可引用性
对每一条观点，标注：
- 是否适合直接引用
- 是否更适合作为背景或论据
- 是否存在争议或样本局限

输出格式（严格）：
{
  "synthesized_insights": [
    {
      "theme": "主题分类",
      "insights": [
        {
          "core_point": "核心观点",
          "evidence": "证据",
          "source_type": "academic / news / web / user",
          "source_title": "来源标题",
          "source_url": "来源链接",
          "usable_as": "核心论点 / 案例 / 背景",
          "notes": "备注"
        }
      ]
    }
  ],
  "key_data_points": [
    {
      "data": "数据点",
      "source": "来源",
      "source_url": "来源链接",
      "year": 2024,
      "reliability": "高 / 中 / 低"
    }
  ],
  "contradictions_or_gaps": [
    "矛盾或空白点描述"
  ],
  "ready_to_cite": "可直接用于文章结构生成的综合版本"
}

行为约束：
❌ 不输出完整文章
❌ 不引入未在资料中出现的新观点
✅ 所有内容服务于后续写作阶段`;

    const userPrompt = `需求文档：
${JSON.stringify(requirementsDoc, null, 2)}

检索结果：
${JSON.stringify(retrievalResults, null, 2)}

请根据以上需求文档和检索结果，进行资料整理和中文化，输出结构化的写作素材包。`;

    // 调用 LLM 进行资料整理
    const llmResponse = await fetch(
      'https://app-9bwpferlujnl-api-VaOwP8E7dJqa.gateway.appmedo.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Gateway-Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          contents: [
            { role: 'user', parts: [{ text: systemPrompt }] },
            {
              role: 'model',
              parts: [
                {
                  text: '我理解了。我是 Research Synthesis Agent，我会将检索到的多源资料转化为中文、结构化、可直接用于写作的研究素材包。',
                },
              ],
            },
            { role: 'user', parts: [{ text: userPrompt }] },
          ],
        }),
      }
    );

    if (!llmResponse.ok) {
      throw new Error(`LLM API 请求失败: ${llmResponse.status}`);
    }

    // 读取流式响应
    const reader = llmResponse.body?.getReader();
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

    // 提取 JSON 内容
    let synthesisResult;
    try {
      // 尝试从 markdown 代码块中提取
      const jsonMatch = fullText.match(/```json\s*([\s\S]*?)\s*```/) || fullText.match(/```\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        synthesisResult = JSON.parse(jsonMatch[1]);
      } else {
        // 尝试直接解析
        const jsonStart = fullText.indexOf('{');
        const jsonEnd = fullText.lastIndexOf('}');
        if (jsonStart !== -1 && jsonEnd !== -1) {
          synthesisResult = JSON.parse(fullText.substring(jsonStart, jsonEnd + 1));
        } else {
          throw new Error('无法找到 JSON 内容');
        }
      }
    } catch (e) {
      console.error('JSON 解析失败:', e);
      console.error('原始文本:', fullText);
      throw new Error(`解析整理结果失败: ${e.message}`);
    }

    // 验证必要字段
    if (!synthesisResult.synthesized_insights || !synthesisResult.key_data_points) {
      throw new Error('整理结果缺少必要字段');
    }

    return new Response(JSON.stringify(synthesisResult), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Research Synthesis Agent Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || '资料整理失败' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
