import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SynthesisRequest {
  retrievalResults: any;
  requirementsDoc: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // 用于收集日志的数组
  const logs: string[] = [];
  const addLog = (...args: any[]) => {
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ');
    console.log(...args);
    logs.push(message);
  };

  try {
    const { retrievalResults, requirementsDoc }: SynthesisRequest = await req.json();

    addLog('========== 接收到的请求参数 ==========');
    addLog(`retrievalResults 存在: ${!!retrievalResults}`);
    addLog(`requirementsDoc 存在: ${!!requirementsDoc}`);

    if (!retrievalResults || !requirementsDoc) {
      return new Response(
        JSON.stringify({ error: '缺少必需参数: retrievalResults 或 requirementsDoc' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const qianwenApiKey = Deno.env.get('QIANWEN_API_KEY');
    
    addLog('========== API Keys 状态检查 ==========');
    addLog(`QIANWEN_API_KEY 存在: ${!!qianwenApiKey}`);
    
    if (!qianwenApiKey) {
      throw new Error('QIANWEN_API_KEY 未配置');
    }

    // 获取当前日期
    const currentDate = new Date().toISOString().split('T')[0]; // 格式：2026-02-09
    
    // 新的系统提示词 - 严格的输出格式
    const systemPrompt = `🧠 Research Synthesis Agent

⏰ Current Date: ${currentDate}
CRITICAL: When synthesizing research materials, prioritize recent data from 2025-2026. If you encounter data from 2023-2024 or earlier, clearly mark it as historical context. Focus on the most current insights and trends.

Role:
你是 CoWrite 的 Research Synthesis Agent。你的职责是将 Research Retrieval Agent 输出的多源资料，整理为中文、结构化、可写作的研究素材。

你不：写完整文章、引入资料中不存在的新观点
你要做到：写作者拿到你的输出，可以直接进入正文写作

Core Tasks（必须完成）:
1️⃣ 中文化（非直译）
- 所有英文资料转为专业但非学术腔的中文
- 面向「商业/产品/技术复合读者」
- 保留原意，不生硬翻译

2️⃣ 信息提炼（高密度）
对每条资料，尽量提取：
- 核心结论/观点
- 关键数据/实证结果
- 使用的方法/分析框架
- 与需求文档中「关键要点」的对应关系
- 如无法提取，明确标记 "缺失"

3️⃣ 结构化归类（主动整理）
你需要帮助写作者理清逻辑，而不是简单堆资料。
推荐（但不限于）以下分类方式：
- 商业化失败模式
- 用户识别与定位方法
- ROI/价值评估方式
- 学术研究 vs 行业实践差异

4️⃣ 标注可引用性
对每一条观点，标注：
- 是否适合直接引用
- 是否更适合作为背景/论据
- 是否存在争议、样本或地区局限

⚠️ 输出规则（极其重要）:
允许 ---THOUGHT---
系统只解析 ---JSON---
---JSON--- 中只能是合法 JSON

Output Format:
---THOUGHT---
（你如何整理、分类和判断可引用性的说明）

---JSON---
{
  "synthesized_insights": [
    {
      "category": "分类名称",
      "insight": "核心洞察（中文）",
      "supporting_data": ["数据点1", "数据点2"],
      "source_type": "academic|news|web",
      "citability": "direct|background|controversial",
      "limitations": "局限性说明（如有）"
    }
  ],
  "key_data_points": [
    {
      "data": "关键数据",
      "context": "数据背景",
      "source": "来源"
    }
  ],
  "contradictions_or_gaps": [
    {
      "issue": "矛盾或空白点",
      "description": "详细说明"
    }
  ]
}

行为约束（强制）:
❌ 不输出完整文章
❌ 不引入资料外的新观点
❌ 不输出 JSON 以外的任何结构化内容
✅ 所有内容只服务于「后续写作」`;

    const userPrompt = `原始需求文档：
${requirementsDoc}

检索到的资料：
${JSON.stringify(retrievalResults, null, 2)}

请整理为可写作的研究素材。`;

    addLog('========== 开始调用通义千问 API ==========');

    // 调用通义千问 API 整理资料
    const llmResponse = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${qianwenApiKey}`,
      },
      body: JSON.stringify({
        model: 'qwen-plus',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 4000,
      }),
    });

    if (!llmResponse.ok) {
      const errorText = await llmResponse.text();
      addLog(`❌ 通义千问 API 错误: ${errorText}`);
      throw new Error(`通义千问 API 请求失败: ${llmResponse.status}`);
    }

    const llmData = await llmResponse.json();
    const content = llmData.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('通义千问 API 返回内容为空');
    }

    addLog('========== 通义千问返回内容 ==========');
    addLog(content);

    // 提取 ---JSON--- 部分
    let synthesisResult;
    try {
      const jsonMatch = content.match(/---JSON---\s*([\s\S]*?)(?:---|\n\n\n|$)/);
      if (!jsonMatch) {
        console.error('未找到 ---JSON--- 标记，原始内容:', content);
        throw new Error('未找到 ---JSON--- 标记');
      }
      
      const jsonText = jsonMatch[1].trim();
      addLog('提取的 JSON 文本:', jsonText);
      
      synthesisResult = JSON.parse(jsonText);
      
      // 验证必需字段
      if (!synthesisResult.synthesized_insights) synthesisResult.synthesized_insights = [];
      if (!synthesisResult.key_data_points) synthesisResult.key_data_points = [];
      if (!synthesisResult.contradictions_or_gaps) synthesisResult.contradictions_or_gaps = [];
      
    } catch (parseError) {
      console.error('JSON 解析失败:', parseError);
      console.error('原始内容:', content);
      throw new Error(`整理结果失败: ${parseError.message}`);
    }

    addLog('整理结果:', JSON.stringify(synthesisResult, null, 2));

    return new Response(
      JSON.stringify({
        success: true,
        data: synthesisResult,
        logs: logs,
        raw_content: content
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('处理请求时出错:', error);
    addLog(`❌ 错误: ${error.message || '处理请求时出错'}`);
    return new Response(
      JSON.stringify({ 
        error: error.message || '处理请求时出错',
        details: error.toString(),
        logs: logs
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
