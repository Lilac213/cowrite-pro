import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { runReviewAgent } from './llm/agents/reviewAgent.ts';

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

    console.log('[review-agent] 开始审校草稿，project_id:', project_id);

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

    // 2. 获取 draft
    const { data: draftData, error: draftError } = await supabase
      .from('drafts')
      .select('payload_jsonb')
      .eq('project_id', project_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (draftError || !draftData) {
      throw new Error('未找到 draft，请先运行 draft-agent');
    }

    const draft = draftData.payload_jsonb;

    console.log('[review-agent] 审校草稿:', {
      draft_blocks: draft.draft_blocks?.length,
      total_word_count: draft.total_word_count
    });

    const startTime = Date.now();

    // 3. 调用 Review Agent
    const reviewPayload = await runReviewAgent({
      writing_brief,
      draft
    });

    const latency = Date.now() - startTime;
    console.log('[review-agent] 审校完成，耗时:', latency, 'ms');

    // 4. 保存到 review_reports 表
    const { data: review, error: insertError } = await supabase
      .from('review_reports')
      .insert({
        project_id,
        payload_jsonb: reviewPayload
      })
      .select()
      .single();

    if (insertError) {
      console.error('[review-agent] 保存失败:', insertError);
      throw insertError;
    }

    // 5. 记录 agent 日志
    await supabase.from('agent_logs').insert({
      project_id,
      agent_name: 'reviewAgent',
      input_payload_jsonb: {
        writing_brief_topic: writing_brief.topic,
        draft_blocks_count: draft.draft_blocks?.length,
        draft_word_count: draft.total_word_count
      },
      output_payload_jsonb: {
        total_issues: reviewPayload.logic_issues.length + 
                      reviewPayload.citation_issues.length + 
                      reviewPayload.style_issues.length + 
                      reviewPayload.grammar_issues.length,
        overall_score: reviewPayload.overall_quality.overall_score,
        pass: reviewPayload.pass
      },
      latency_ms: latency,
      status: 'success'
    });

    console.log('[review-agent] 审校报告已保存，review_id:', review.id);

    return new Response(
      JSON.stringify({
        success: true,
        review_id: review.id,
        review_payload: reviewPayload
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[review-agent] 错误:', error);
    
    // 记录错误日志
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      const { project_id } = await req.json();
      if (project_id) {
        await supabase.from('agent_logs').insert({
          project_id,
          agent_name: 'reviewAgent',
          status: 'error',
          error_message: error instanceof Error ? error.message : String(error)
        });
      }
    } catch (logError) {
      console.error('[review-agent] 记录错误日志失败:', logError);
    }
    
    return new Response(
      JSON.stringify({
        error: 'Review Agent 运行失败',
        details: error instanceof Error ? error.message : String(error)
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
