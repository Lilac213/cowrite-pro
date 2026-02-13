import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { runDraftAgent } from '../_shared/llm/agents/draftAgent.ts';

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

    console.log('[draft-agent] 开始生成草稿，project_id:', project_id);

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

    // 2. 获取 argument_outline
    const { data: structure, error: structError } = await supabase
      .from('article_structures')
      .select('payload_jsonb')
      .eq('project_id', project_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (structError || !structure) {
      throw new Error('未找到 argument_outline，请先运行 structure-agent');
    }

    const argument_outline = structure.payload_jsonb;

    // 3. 获取 research_pack
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
      throw new Error('未找到 research_pack，请先运行 research-agent');
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

    console.log('[draft-agent] 使用依赖:', {
      writing_brief: !!writing_brief,
      argument_outline: !!argument_outline,
      research_pack_insights: research_pack.insights.length,
      research_pack_sources: research_pack.sources.length
    });

    const startTime = Date.now();

    // 4. 调用 Draft Agent
    const draftPayload = await runDraftAgent({
      writing_brief,
      argument_outline,
      research_pack
    });

    const latency = Date.now() - startTime;
    console.log('[draft-agent] 生成完成，耗时:', latency, 'ms');

    // 5. 保存到 drafts 表
    const { data: draft, error: insertError } = await supabase
      .from('drafts')
      .insert({
        project_id,
        payload_jsonb: draftPayload,
        version: 1,
        global_coherence_score: draftPayload.global_coherence_score
      })
      .select()
      .single();

    if (insertError) {
      console.error('[draft-agent] 保存失败:', insertError);
      throw insertError;
    }

    // 6. 记录 agent 日志
    await supabase.from('agent_logs').insert({
      project_id,
      agent_name: 'draftAgent',
      input_payload_jsonb: {
        writing_brief_topic: writing_brief.topic,
        argument_outline_blocks: argument_outline.argument_blocks?.length,
        research_pack_summary: research_pack.summary
      },
      output_payload_jsonb: {
        draft_blocks_count: draftPayload.draft_blocks.length,
        total_word_count: draftPayload.total_word_count,
        global_coherence_score: draftPayload.global_coherence_score
      },
      latency_ms: latency,
      status: 'success'
    });

    console.log('[draft-agent] 草稿已保存，draft_id:', draft.id);

    return new Response(
      JSON.stringify({
        success: true,
        draft_id: draft.id,
        draft_payload: draftPayload
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[draft-agent] 错误:', error);
    
    // 记录错误日志
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      const { project_id } = await req.json();
      if (project_id) {
        await supabase.from('agent_logs').insert({
          project_id,
          agent_name: 'draftAgent',
          status: 'error',
          error_message: error instanceof Error ? error.message : String(error)
        });
      }
    } catch (logError) {
      console.error('[draft-agent] 记录错误日志失败:', logError);
    }
    
    return new Response(
      JSON.stringify({
        error: 'Draft Agent 运行失败',
        details: error instanceof Error ? error.message : String(error)
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
