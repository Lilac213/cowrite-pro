import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { runLLMAgent } from '../_shared/llm/runtime/LLMRuntime.ts';

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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
    
    let input: ResearchSynthesisInput;
    let sessionId: string | undefined;
    
    if (body.input) {
      input = body.input;
      sessionId = body.sessionId;
    } else if (body.projectId) {
      const projectId = body.projectId;
      sessionId = body.sessionId;

      if (!projectId) {
        return new Response(JSON.stringify({ error: "缺少 projectId 或 input 参数" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: project, error: projectError } = await supabase.from("projects").select("title").eq("id", projectId).maybeSingle();
      if (projectError || !project) {
        return new Response(JSON.stringify({ error: "项目不存在" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: brief, error: briefError } = await supabase.from("briefs").select("requirements").eq("project_id", projectId).maybeSingle();
      if (briefError || !brief) {
        return new Response(JSON.stringify({ error: "需求文档不存在" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      let knowledge: any[] = [];
      
      // 先尝试从 retrieved_materials 获取
      if (sessionId) {
        const { data: retrievedMaterials, error: retrievedError } = await supabase.from("retrieved_materials").select("*").eq("session_id", sessionId).eq("is_selected", true).order("created_at", { ascending: false });
        if (!retrievedError && retrievedMaterials && retrievedMaterials.length > 0) {
          knowledge = (retrievedMaterials || []).map((item: any) => {
            const content = (item.full_text || item.abstract || '').replace(/[\n\r\t]/g, ' ').replace(/\s+/g, ' ').trim();
            return { title: (item.title || '无标题').trim(), source: item.source_type || 'unknown', source_url: item.url || '', content: content.substring(0, 2000), collected_at: item.created_at };
          });
        }
      }
      
      // 如果 retrieved_materials 为空，从 knowledge_base 获取
      if (knowledge.length === 0) {
        const { data: knowledgeData, error: knowledgeError } = await supabase.from("knowledge_base").select("*").eq("project_id", projectId).order("collected_at", { ascending: false });
        if (knowledgeError) {
          return new Response(JSON.stringify({ error: "获取知识库失败" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        knowledge = (knowledgeData || []).map((item: any) => {
          const content = (item.content || item.full_text || '').replace(/[\n\r\t]/g, ' ').replace(/\s+/g, ' ').trim();
          return { ...item, title: (item.title || '无标题').trim(), source: item.source || 'unknown', source_url: item.source_url || '', content: content.substring(0, 2000) };
        });
      }

      if (!knowledge || knowledge.length === 0) {
        return new Response(JSON.stringify({ error: "知识库为空，请先进行资料搜索" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      let requirements: any = {};
      try { requirements = JSON.parse(brief.requirements); } catch { requirements = { topic: project.title }; }

      input = {
        writing_requirements: { topic: requirements.topic || project.title, target_audience: requirements.target_audience, writing_purpose: requirements.writing_purpose, key_points: requirements.key_points },
        raw_materials: knowledge.map((item: any) => ({ title: item.title, source: item.source, source_url: item.source_url, content: item.content })),
      };
    } else {
      return new Response(JSON.stringify({ error: "缺少 projectId 或 input 参数" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let materialsContent = "";
    input.raw_materials.forEach((item, index) => {
      materialsContent += `\n\n【资料 ${index + 1}】\n标题: ${item.title}\n来源: ${item.source}\n${item.source_url ? `链接: ${item.source_url}\n` : ''}内容:\n${item.content}\n`;
    });

    let requirementsText = `写作主题: ${input.writing_requirements.topic}\n`;
    if (input.writing_requirements.target_audience) requirementsText += `目标读者: ${input.writing_requirements.target_audience}\n`;
    if (input.writing_requirements.writing_purpose) requirementsText += `写作目的: ${input.writing_requirements.writing_purpose}\n`;
    if (input.writing_requirements.key_points?.length) requirementsText += `关键要点: ${input.writing_requirements.key_points.join(', ')}\n`;

    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentDateStr = currentDate.toISOString().split('T')[0];

    const systemPrompt = `Research Synthesis Agent (LLM Runtime Version)

Current Date: ${currentDateStr}
Current Year: ${currentYear}

Role:
你是 CoWrite 的 Research Synthesis Agent。将多源检索资料整理为可供写作选择的研究素材池。

Core Tasks:
1. 中文化（非直译）- 面向商业/产品/技术复合读者，保留原意
2. 高密度提炼 - 核心结论、关键数据、方法框架、与需求对应关系
3. 主动结构化 - 分类帮助用户理解，不做价值取舍
4. 显式标注 - recommended_usage: direct | background | optional
5. 标注不确定性与争议

Output Format (Envelope Mode):
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

Rules:
- 所有 insight 默认 user_decision = pending
- 不得假设用户的立场
- 不得为下游结构生成提前收敛观点`;

    const userPrompt = `请对以下资料进行研究综合整理：

【写作需求】
${requirementsText}

【检索资料】
${materialsContent}

请按照 Research Synthesis Agent 的要求，将这些资料整理为可供用户选择的研究素材池。`;

    console.log("========== 使用 LLM Runtime 进行资料综合 ==========");

    const result = await runLLMAgent({
      agentName: 'researchSynthesisAgent',
      prompt: `${systemPrompt}\n\n${userPrompt}`,
      schema: {
        required: ['synthesized_insights'],
        optional: ['contradictions_or_gaps']
      },
      model: 'gemini-2.5-flash',
      temperature: 0.7,
      maxTokens: 4000,
    });

    const synthesisData = result.data;
    console.log(`[research-synthesis-agent] 成功生成 ${synthesisData.synthesized_insights?.length || 0} 条洞察`);

    if (!synthesisData.synthesized_insights) synthesisData.synthesized_insights = [];
    if (!synthesisData.contradictions_or_gaps) synthesisData.contradictions_or_gaps = [];

    if (sessionId) {
      if (synthesisData.synthesized_insights?.length > 0) {
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
        const { error: insightsError } = await supabase.from("research_insights").insert(insightsToInsert);
        if (insightsError) console.error("保存 insights 失败:", insightsError);
      }

      if (synthesisData.contradictions_or_gaps?.length > 0) {
        const gapsToInsert = synthesisData.contradictions_or_gaps.map((gap: any) => ({
          session_id: sessionId,
          gap_id: gap.id,
          issue: gap.issue,
          description: gap.description,
          user_decision: "pending",
        }));
        const { error: gapsError } = await supabase.from("research_gaps").insert(gapsToInsert);
        if (gapsError) console.error("保存 gaps 失败:", gapsError);
      }
    }

    return new Response(JSON.stringify({ thought: result.rawOutput?.match(/---THOUGHT---\s*([\s\S]*?)---JSON---/)?.[1]?.trim() || "", synthesis: synthesisData, sessionId }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: any) {
    console.error("Research Synthesis Agent 错误:", error);
    return new Response(JSON.stringify({ error: error.message || "处理失败" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
