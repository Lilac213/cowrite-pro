import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { runStructureAgent } from '../_shared/llm/agents/structureAgent.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { project_id } = await req.json();

    if (!project_id) {
      return new Response(
        JSON.stringify({ error: '缺少必需参数：project_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[structure-agent] 开始生成文章结构，project_id:', project_id);

    // 1. 获取 writing_brief
    const { data: requirement, error: reqError } = await supabase
      .from('requirements')
      .select('payload_jsonb')
      .eq('project_id', project_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (reqError || !requirement) {
      throw new Error('未找到 writing_brief，请先运行 brief-agent');
    }

    const writing_brief = requirement.payload_jsonb;

    // 2. 获取 research_pack（从 synthesized_insights 和 research_sources）
    const { data: insights, error: insightsError } = await supabase
      .from('synthesized_insights')
      .select('*')
      .eq('project_id', project_id)
      .eq('user_decision', 'confirmed');

    if (insightsError) throw insightsError;

    const { data: sources, error: sourcesError } = await supabase
      .from('research_sources')
      .select('*')
      .eq('project_id', project_id);

    if (sourcesError) throw sourcesError;

    if (!insights || insights.length === 0) {
      throw new Error('未找到 research_pack，请先运行 research-agent 并确认洞察');
    }

    const research_pack = {
      sources: sources || [],
      insights: insights.map(i => ({
        id: i.id,
        category: i.category,
        content: i.content,
        supporting_source_ids: i.supporting_source_ids || [],
        citability: i.citability,
        evidence_strength: i.evidence_strength,
        risk_flag: i.risk_flag,
        confidence_score: i.confidence_score
      })),
      summary: {
        total_sources: sources?.length || 0,
        total_insights: insights.length,
        coverage_score: 0.8,
        quality_score: 0.85
      }
    };

    console.log('[structure-agent] 使用 research_pack:', {
      sources: research_pack.sources.length,
      insights: research_pack.insights.length
    });

    const startTime = Date.now();

    // 3. 调用 Structure Agent
    const argumentOutline = await runStructureAgent({
      writing_brief,
      research_pack
    });

    const latency = Date.now() - startTime;
    console.log('[structure-agent] 生成完成，耗时:', latency, 'ms');

    // 4. 保存到 article_structures 表
    const { data: structure, error: insertError } = await supabase
      .from('article_structures')
      .insert({
        project_id,
        payload_jsonb: argumentOutline,
        version: 1
      })
      .select()
      .single();

    if (insertError) {
      console.error('[structure-agent] 保存失败:', insertError);
      throw insertError;
    }

    // 5. 记录 agent 日志
    await supabase.from('agent_logs').insert({
      project_id,
      agent_name: 'structureAgent',
      input_payload_jsonb: { writing_brief, research_pack_summary: research_pack.summary },
      output_payload_jsonb: argumentOutline,
      latency_ms: latency,
      status: 'success'
    });

    console.log('[structure-agent] 文章结构已保存，structure_id:', structure.id);

    return new Response(
      JSON.stringify({
        success: true,
        structure_id: structure.id,
        argument_outline: argumentOutline
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[structure-agent] 错误:', error);
    
    // 记录错误日志
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      const { project_id } = await req.json();
      if (project_id) {
        await supabase.from('agent_logs').insert({
          project_id,
          agent_name: 'structureAgent',
          status: 'error',
          error_message: error instanceof Error ? error.message : String(error)
        });
      }
    } catch (logError) {
      console.error('[structure-agent] 记录错误日志失败:', logError);
    }
    
    return new Response(
      JSON.stringify({
        error: 'Structure Agent 运行失败',
        details: error instanceof Error ? error.message : String(error)
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
