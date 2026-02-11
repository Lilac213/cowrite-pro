import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

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
/**
 * 清理和修复 JSON 文本中的常见问题
 */
function cleanJsonText(jsonText: string): string {
  // 移除 markdown 代码块标记
  jsonText = jsonText.replace(/^```json\s*/i, '').replace(/\s*```\s*$/, '');
  
  // 移除 BOM 和其他不可见字符
  jsonText = jsonText.replace(/^\uFEFF/, '');
  
  // 移除尾部的逗号（在数组或对象的最后一个元素后）
  jsonText = jsonText.replace(/,(\s*[}\]])/g, '$1');
  
  // 尝试修复未转义的换行符（在字符串中）
  // 这个比较复杂，需要小心处理
  
  return jsonText.trim();
}

// ============ End of LLM Client ============

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// 输入接口定义
interface ResearchSynthesisInput {
  writing_requirements: {
    topic: string;
    target_audience?: string;
    writing_purpose?: string;
    key_points?: string[];
  };
  raw_materials: Array<{
    title: string;
    source: string;
    source_url?: string;
    content: string;
  }>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    
    // 支持两种输入格式：
    // 1. 新格式：{ input: ResearchSynthesisInput, sessionId?: string }
    // 2. 旧格式（兼容）：{ projectId: string, sessionId?: string }
    let input: ResearchSynthesisInput;
    let sessionId: string | undefined;
    
    if (body.input) {
      // 新格式
      input = body.input;
      sessionId = body.sessionId;
    } else if (body.projectId) {
      // 旧格式 - 从数据库读取
      const projectId = body.projectId;
      sessionId = body.sessionId;

      if (!projectId) {
        return new Response(
          JSON.stringify({ error: "缺少 projectId 或 input 参数" }),
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

      // 获取资料：优先从 retrieved_materials（如果有 sessionId），否则从 knowledge_base
      let knowledge: any[] = [];
      
      if (sessionId) {
        // 新工作流：从 retrieved_materials 获取
        // 注意：不强制要求 is_selected = true，因为可能是自动触发的综合分析
        const { data: retrievedMaterials, error: retrievedError } = await supabase
          .from("retrieved_materials")
          .select("*")
          .eq("session_id", sessionId)
          .order("created_at", { ascending: false });

        if (retrievedError) {
          return new Response(
            JSON.stringify({ error: "获取检索资料失败" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // 转换 retrieved_materials 格式为 knowledge_base 格式
        knowledge = (retrievedMaterials || []).map((item: any) => ({
          title: item.title,
          source: item.source_type,
          source_url: item.url,
          content: item.full_text || item.abstract || '',
          collected_at: item.created_at,
        }));
      } else {
        // 旧工作流：从 knowledge_base 获取
        const { data: knowledgeData, error: knowledgeError } = await supabase
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

        knowledge = knowledgeData || [];
      }

      if (!knowledge || knowledge.length === 0) {
        return new Response(
          JSON.stringify({ error: "知识库为空，请先进行资料搜索" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // 转换为新格式
      let requirements: any = {};
      try {
        requirements = JSON.parse(brief.requirements);
      } catch {
        requirements = { topic: project.title };
      }

      input = {
        writing_requirements: {
          topic: requirements.topic || project.title,
          target_audience: requirements.target_audience,
          writing_purpose: requirements.writing_purpose,
          key_points: requirements.key_points,
        },
        raw_materials: knowledge.map((item: any) => ({
          title: item.title,
          source: item.source,
          source_url: item.source_url,
          content: item.content,
        })),
      };
    } else {
      return new Response(
        JSON.stringify({ error: "缺少 projectId 或 input 参数" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 构建资料内容
    let materialsContent = "";
    input.raw_materials.forEach((item, index) => {
      materialsContent += `\n\n【资料 ${index + 1}】\n`;
      materialsContent += `标题: ${item.title}\n`;
      materialsContent += `来源: ${item.source}\n`;
      if (item.source_url) {
        materialsContent += `链接: ${item.source_url}\n`;
      }
      materialsContent += `内容:\n${item.content}\n`;
    });

    // 构建需求文档文本
    let requirementsText = `写作主题: ${input.writing_requirements.topic}\n`;
    if (input.writing_requirements.target_audience) {
      requirementsText += `目标读者: ${input.writing_requirements.target_audience}\n`;
    }
    if (input.writing_requirements.writing_purpose) {
      requirementsText += `写作目的: ${input.writing_requirements.writing_purpose}\n`;
    }
    if (input.writing_requirements.key_points && input.writing_requirements.key_points.length > 0) {
      requirementsText += `关键要点: ${input.writing_requirements.key_points.join(', ')}\n`;
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
- JSON 必须是有效的、格式正确的 JSON，不能有语法错误
- 字符串中的引号必须转义，换行符使用 \n
- 不要在 JSON 中使用注释

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
---END---

⚠️ JSON 格式要求（强制）:
- 必须以 ---JSON--- 开始，以 ---END--- 结束
- JSON 对象必须完整，所有括号必须匹配
- 字符串中不能有未转义的引号或换行符
- 数组最后一个元素后不能有逗号
- 对象最后一个属性后不能有逗号

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
    const jsonMatch = content.match(/---JSON---\s*([\s\S]*?)(?:---END---|---THOUGHT|$)/);
    if (!jsonMatch) {
      console.error("无法找到 JSON 标记，LLM 返回内容:", content.substring(0, 500));
      return new Response(
        JSON.stringify({ error: "无法解析 LLM 返回的 JSON：未找到 JSON 标记" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let jsonText = cleanJsonText(jsonMatch[1]);
    
    // 尝试解析 JSON
    let synthesisData: any;
    try {
      synthesisData = JSON.parse(jsonText);
    } catch (parseError: any) {
      console.error("JSON 解析失败:", parseError.message);
      console.error("JSON 文本（前 1000 字符）:", jsonText.substring(0, 1000));
      
      return new Response(
        JSON.stringify({ 
          error: "JSON 解析失败", 
          details: parseError.message,
          jsonPreview: jsonText.substring(0, 500)
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 验证数据结构
    if (!synthesisData || typeof synthesisData !== 'object') {
      return new Response(
        JSON.stringify({ error: "解析的数据格式不正确" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 确保必要字段存在
    if (!synthesisData.synthesized_insights) {
      synthesisData.synthesized_insights = [];
    }
    if (!synthesisData.contradictions_or_gaps) {
      synthesisData.contradictions_or_gaps = [];
    }

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
