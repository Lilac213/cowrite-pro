import { createClient } from "jsr:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============ 统一的 LLM 调用客户端 ============
interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface LLMCallOptions {
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
}

interface LLMResponse {
  content: string;
  model: string;
}

/**
 * 调用内置 Gemini 模型
 */
async function callGemini(options: LLMCallOptions): Promise<LLMResponse> {
  const geminiUrl = "https://app-9bwpferlujnl-api-VaOwP8E7dJqa.gateway.appmedo.com/v1beta/models/gemini-2.5-flash:generateContent";
  
  const systemInstruction = options.messages.find(m => m.role === 'system')?.content || '';
  const contents = options.messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

  const requestBody: any = {
    contents,
    generationConfig: {
      temperature: options.temperature || 0.7,
      maxOutputTokens: options.maxTokens || 4096,
    }
  };

  if (systemInstruction) {
    requestBody.systemInstruction = {
      parts: [{ text: systemInstruction }]
    };
  }

  const response = await fetch(geminiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API 调用失败 (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  
  return { content, model: 'gemini-2.5-flash' };
}

/**
 * 调用用户配置的 Qwen 模型（通过阿里云 DashScope）
 */
async function callQwen(options: LLMCallOptions, apiKey: string): Promise<LLMResponse> {
  const response = await fetch("https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation", {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "qwen-plus",
      input: {
        messages: options.messages,
      },
      parameters: {
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 4096,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Qwen API 调用失败 (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const content = data.output?.text || data.output?.choices?.[0]?.message?.content || '';
  
  return { content, model: 'qwen-plus' };
}

/**
 * 获取用户配置的 API 密钥
 */
async function getQwenApiKey(): Promise<string | null> {
  const { data: configData } = await supabase
    .from("system_config")
    .select("config_value")
    .eq("config_key", "llm_api_key")
    .maybeSingle();
  
  return configData?.config_value || Deno.env.get("DASHSCOPE_API_KEY") || null;
}

/**
 * 统一的 LLM 调用接口（优先 Gemini，回退 Qwen）
 */
async function callLLM(options: LLMCallOptions): Promise<LLMResponse> {
  try {
    console.log("尝试调用内置 Gemini 模型...");
    const response = await callGemini(options);
    console.log("✓ Gemini 调用成功");
    return response;
  } catch (geminiError) {
    console.warn("Gemini 调用失败，尝试回退到 Qwen:", geminiError);
    
    try {
      const apiKey = await getQwenApiKey();
      if (!apiKey) {
        throw new Error(
          "Gemini 调用失败，且未配置 Qwen API 密钥。" +
          "请在管理面板的「系统配置」→「LLM 配置」中配置阿里云 DashScope API 密钥。"
        );
      }
      
      console.log("尝试调用用户配置的 Qwen 模型...");
      const response = await callQwen(options, apiKey);
      console.log("✓ Qwen 调用成功（回退）");
      return response;
    } catch (qwenError) {
      console.error("Qwen 调用也失败:", qwenError);
      throw new Error(`LLM 调用失败：Gemini 和 Qwen 均不可用`);
    }
  }
}
// ============ End of LLM Client ============

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { projectId, sessionId } = await req.json();

    if (!projectId) {
      return new Response(
        JSON.stringify({ error: "缺少 projectId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 获取项目信息
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("title")
      .eq("id", projectId)
      .maybeSingle();

    if (projectError || !project) {
      return new Response(
        JSON.stringify({ error: "项目不存在" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 获取需求文档
    const { data: brief, error: briefError } = await supabase
      .from("briefs")
      .select("requirements")
      .eq("project_id", projectId)
      .maybeSingle();

    if (briefError || !brief) {
      return new Response(
        JSON.stringify({ error: "需求文档不存在" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 获取知识库资料
    const { data: knowledge, error: knowledgeError } = await supabase
      .from("knowledge_base")
      .select("*")
      .eq("project_id", projectId)
      .order("collected_at", { ascending: false });

    if (knowledgeError) {
      return new Response(
        JSON.stringify({ error: "获取知识库失败" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!knowledge || knowledge.length === 0) {
      return new Response(
        JSON.stringify({ error: "知识库为空，请先进行资料搜索" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 构建资料内容
    let materialsContent = "";
    knowledge.forEach((item: any, index: number) => {
      materialsContent += `\n\n【资料 ${index + 1}】\n`;
      materialsContent += `标题: ${item.title}\n`;
      materialsContent += `来源: ${item.source}\n`;
      if (item.source_url) {
        materialsContent += `链接: ${item.source_url}\n`;
      }
      materialsContent += `内容:\n${item.content}\n`;
    });

    // 解析需求文档
    let requirementsText = "";
    try {
      const reqDoc = JSON.parse(brief.requirements);
      requirementsText = `写作主题: ${reqDoc.topic || project.title}\n`;
      if (reqDoc.target_audience) {
        requirementsText += `目标读者: ${reqDoc.target_audience}\n`;
      }
      if (reqDoc.writing_purpose) {
        requirementsText += `写作目的: ${reqDoc.writing_purpose}\n`;
      }
      if (reqDoc.key_points) {
        requirementsText += `关键要点: ${reqDoc.key_points}\n`;
      }
    } catch {
      requirementsText = `写作主题: ${project.title}\n`;
    }

    // 获取当前日期和年份
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentDateStr = currentDate.toISOString().split('T')[0];

    // 构建 system prompt
    const systemPrompt = `🧠 Research Synthesis Agent (User-Gated)

⏰ Current Date: ${currentDateStr}
⏰ Current Year: ${currentYear}

📅 时效性说明：
- 历史资料可以作为参考，不强制要求只使用当年资料
- 如果用户需求中明确提到特定年份（如"${currentYear}年"），应优先使用该年份的资料
- 对于较旧的资料，应在整理时标注其发布时间，让用户了解时效性

Role:
你是 CoWrite 的 Research Synthesis Agent。
你的职责是：将多源检索资料，整理为【可供写作选择的研究素材池】。

🔒 重要定位（强制）：
- 你【不负责判断哪些观点最终会被使用】
- 你【不做价值取舍或立场选择】
- 所有观点都必须以「等待用户决策」的状态输出

你不：
❌ 写完整文章  
❌ 生成结论性判断  
❌ 隐性替用户做取舍  

你要做到：
✅ 让用户可以"勾选 / 排除 / 降级使用"每一条研究洞察  
✅ 为后续结构生成提供清晰、可裁剪的素材空间  

Core Tasks:

1️⃣ 中文化（非直译）
- 面向商业 / 产品 / 技术复合读者
- 保留原意，不做写作加工

2️⃣ 高密度提炼
对每条资料提取：
- 核心结论 / 观点
- 关键数据或实证
- 使用的方法或分析框架
- 与原始需求的对应关系
- 若缺失，明确标记 "缺失"

3️⃣ 主动结构化（不等于取舍）
你必须将观点归类，但不得暗示"更重要 / 次要"。
分类只用于帮助用户快速理解与选择。

4️⃣ 显式标注【用户决策位】
对每一条 insight，必须标注：
- recommended_usage: direct | background | optional
⚠️ 该字段只是"推荐"，不是最终决定，用户可以覆盖。

5️⃣ 标注不确定性与争议
- 样本、时间、地区、方法限制
- 潜在冲突或相互矛盾点

⚠️ 输出规则（强制）:
- 允许 ---THOUGHT---
- 系统只解析 ---JSON---
- JSON 必须是「等待用户筛选的素材池」，而不是可直接写作内容

Output Format:
---THOUGHT---
（你如何归类信息，以及哪些地方需要用户重点决策）

---JSON---
{
  "synthesized_insights": [
    {
      "id": "insight_1",
      "category": "分类名称",
      "insight": "核心洞察（中文）",
      "supporting_data": ["数据点1", "数据点2"],
      "source_type": "academic | news | web",
      "recommended_usage": "direct | background | optional",
      "citability": "direct | background | controversial",
      "limitations": "局限性说明",
      "user_decision": "pending"
    }
  ],
  "contradictions_or_gaps": [
    {
      "id": "gap_1",
      "issue": "矛盾或空白点",
      "description": "说明",
      "user_decision": "pending"
    }
  ]
}

🔒 行为约束（强制）:
- 所有 insight 默认 user_decision = pending
- 不得假设用户的立场
- 不得为下游结构生成提前收敛观点`;

    // 构建用户消息
    const userMessage = `请对以下资料进行研究综合整理：

【写作需求】
${requirementsText}

【检索资料】
${materialsContent}

请按照 Research Synthesis Agent 的要求，将这些资料整理为可供用户选择的研究素材池。`;

    // 调用 LLM（优先 Gemini，回退 Qwen）
    console.log("开始调用 LLM 进行资料综合...");
    const llmResult = await callLLM({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
      ],
      temperature: 0.7,
      maxTokens: 4000,
    });

    console.log(`LLM 调用成功，使用模型: ${llmResult.model}`);
    const content = llmResult.content;

    // 解析 JSON
    const jsonMatch = content.match(/---JSON---\s*([\s\S]*?)(?:---|\n\n|$)/);
    if (!jsonMatch) {
      return new Response(
        JSON.stringify({ error: "无法解析 LLM 返回的 JSON" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const synthesisData = JSON.parse(jsonMatch[1].trim());

    // 提取 THOUGHT
    const thoughtMatch = content.match(/---THOUGHT---\s*([\s\S]*?)---JSON---/);
    const thought = thoughtMatch ? thoughtMatch[1].trim() : "";

    // 如果提供了 sessionId，保存到数据库
    if (sessionId) {
      // 保存 insights
      if (synthesisData.synthesized_insights && synthesisData.synthesized_insights.length > 0) {
        const insightsToInsert = synthesisData.synthesized_insights.map((insight: any) => ({
          session_id: sessionId,
          insight_id: insight.id,
          category: insight.category,
          insight: insight.insight,
          supporting_data: insight.supporting_data || [],
          source_type: insight.source_type,
          recommended_usage: insight.recommended_usage,
          citability: insight.citability,
          limitations: insight.limitations || "",
          user_decision: "pending",
        }));

        const { error: insightsError } = await supabase
          .from("research_insights")
          .insert(insightsToInsert);

        if (insightsError) {
          console.error("保存 insights 失败:", insightsError);
        }
      }

      // 保存 gaps
      if (synthesisData.contradictions_or_gaps && synthesisData.contradictions_or_gaps.length > 0) {
        const gapsToInsert = synthesisData.contradictions_or_gaps.map((gap: any) => ({
          session_id: sessionId,
          gap_id: gap.id,
          issue: gap.issue,
          description: gap.description,
          user_decision: "pending",
        }));

        const { error: gapsError } = await supabase
          .from("research_gaps")
          .insert(gapsToInsert);

        if (gapsError) {
          console.error("保存 gaps 失败:", gapsError);
        }
      }
    }

    return new Response(
      JSON.stringify({
        thought,
        synthesis: synthesisData,
        sessionId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Research Synthesis Agent 错误:", error);
    console.error("错误堆栈:", error.stack);
    console.error("错误详情:", JSON.stringify(error, null, 2));
    
    // 构建详细的错误响应
    const errorResponse = {
      error: error.message || "处理失败",
      details: {
        type: error.name || "UnknownError",
        message: error.message,
        stack: error.stack,
        cause: error.cause,
      },
      timestamp: new Date().toISOString(),
    };
    
    return new Response(
      JSON.stringify(errorResponse),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
