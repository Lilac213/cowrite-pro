import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { runBriefAgent } from '../_shared/llm/agents/briefAgent.ts';

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

    const { project_id, topic, user_input, context } = await req.json();

    if (!project_id || !topic || !user_input) {
      return new Response(
        JSON.stringify({ error: '缺少必需参数：project_id, topic, user_input' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[brief-agent] 开始生成需求文档，project_id:', project_id);
    const startTime = Date.now();

    // 调用 Brief Agent
    const writingBrief = await runBriefAgent({
      topic,
      user_input,
      context
    });

    const latency = Date.now() - startTime;
    console.log('[brief-agent] 生成完成，耗时:', latency, 'ms');

    // 保存到 requirements 表
    const { data: requirement, error: insertError } = await supabase
      .from('requirements')
      .insert({
        project_id,
        payload_jsonb: writingBrief,
        version: 1
      })
      .select()
      .single();

    if (insertError) {
      console.error('[brief-agent] 保存失败:', insertError);
      throw insertError;
    }

    // 记录 agent 日志
    await supabase.from('agent_logs').insert({
      project_id,
      agent_name: 'briefAgent',
      input_payload_jsonb: { topic, user_input, context },
      output_payload_jsonb: writingBrief,
      latency_ms: latency,
      status: 'success'
    });

    console.log('[brief-agent] 需求文档已保存，requirement_id:', requirement.id);

    return new Response(
      JSON.stringify({
        success: true,
        requirement_id: requirement.id,
        writing_brief: writingBrief
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[brief-agent] 错误:', error);
    
    return new Response(
      JSON.stringify({
        error: 'Brief Agent 运行失败',
        details: error instanceof Error ? error.message : String(error)
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
