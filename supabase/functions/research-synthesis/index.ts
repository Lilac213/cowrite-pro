import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { runResearchSynthesis } from './llm/agents/researchAgent.ts';

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

    console.log('[research-synthesis] 开始资料整理，project_id:', project_id);

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

    // 2. 获取搜索到的资料
    const { data: sources, error: sourcesError } = await supabase
      .from('research_sources')
      .select('*')
      .eq('project_id', project_id)
      .order('relevance_score', { ascending: false });

    if (sourcesError) throw sourcesError;

    if (!sources || sources.length === 0) {
      throw new Error('未找到搜索资料，请先运行 research-retrieval');
    }

    console.log('[research-synthesis] 资料数量:', sources.length);

    // 3. 分离外部资料和个人资料
    const externalSources = sources.filter(s => s.source_type !== 'personal');
    const personalSources = sources.filter(s => s.source_type === 'personal');

    const startTime = Date.now();

    // 4. 调用 Research Synthesis
    const insights = await runResearchSynthesis({
      writing_brief,
      retrieved_sources: externalSources,
      personal_materials: personalSources
    });

    const latency = Date.now() - startTime;
    console.log('[research-synthesis] 整理完成，耗时:', latency, 'ms');
    console.log('[research-synthesis] 生成洞察数量:', insights.length);

    // 5. 保存洞察到 synthesized_insights 表
    const { error: insertError } = await supabase
      .from('synthesized_insights')
      .insert(
        insights.map(insight => ({
          project_id,
          id: insight.id,
          category: insight.category,
          content: insight.content,
          supporting_source_ids: insight.supporting_source_ids,
          evidence_strength: insight.evidence_strength,
          citability: insight.citability,
          user_decision: 'pending',
          confidence_score: insight.confidence_score,
          risk_flag: insight.risk_flag
        }))
      );

    if (insertError) {
      console.error('[research-synthesis] 保存失败:', insertError);
      throw insertError;
    }

    // 6. 记录 agent 日志
    await supabase.from('agent_logs').insert({
      project_id,
      agent_name: 'researchAgent.synthesis',
      input_payload_jsonb: {
        writing_brief_topic: writing_brief.topic,
        sources_count: sources.length
      },
      output_payload_jsonb: {
        insights_count: insights.length,
        avg_confidence: insights.reduce((sum, i) => sum + i.confidence_score, 0) / insights.length
      },
      latency_ms: latency,
      status: 'success'
    });

    console.log('[research-synthesis] 洞察已保存');

    return new Response(
      JSON.stringify({
        success: true,
        insights_count: insights.length,
        insights: insights
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[research-synthesis] 错误:', error);
    
    // 记录错误日志
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      const { project_id } = await req.json();
      if (project_id) {
        await supabase.from('agent_logs').insert({
          project_id,
          agent_name: 'researchAgent.synthesis',
          status: 'error',
          error_message: error instanceof Error ? error.message : String(error)
        });
      }
    } catch (logError) {
      console.error('[research-synthesis] 记录错误日志失败:', logError);
    }
    
    return new Response(
      JSON.stringify({
        error: 'Research Synthesis 运行失败',
        details: error instanceof Error ? error.message : String(error)
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
