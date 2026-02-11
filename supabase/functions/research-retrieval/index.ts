import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { runResearchRetrieval } from './llm/agents/researchAgent.ts';

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

    const { project_id, search_depth } = await req.json();

    if (!project_id) {
      return new Response(
        JSON.stringify({ error: '缺少必需参数：project_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[research-retrieval] 开始资料搜索，project_id:', project_id);

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

    // 2. 获取个人资料库（如果有）
    const { data: personalMaterials } = await supabase
      .from('materials')
      .select('*')
      .eq('user_id', (await supabase.auth.getUser()).data.user?.id);

    console.log('[research-retrieval] 个人资料数量:', personalMaterials?.length || 0);

    const startTime = Date.now();

    // 3. 调用 Research Retrieval
    const retrievalResult = await runResearchRetrieval({
      writing_brief,
      personal_materials: personalMaterials || [],
      search_depth: search_depth || 'medium'
    });

    const latency = Date.now() - startTime;
    console.log('[research-retrieval] 搜索完成，耗时:', latency, 'ms');

    // 4. 这里应该调用外部搜索API（如Google、Bing等）
    // 为了演示，我们创建一些模拟数据
    const mockExternalSources = [
      {
        id: `source_${Date.now()}_1`,
        title: '示例资料1',
        content: '这是一个示例资料内容...',
        summary: '示例摘要',
        source_url: 'https://example.com/1',
        source_type: 'web',
        credibility_score: 0.8,
        recency_score: 0.9,
        relevance_score: 0.85,
        token_length: 500,
        tags: ['示例'],
        created_at: new Date().toISOString()
      }
    ];

    // 5. 保存搜索结果到 research_sources 表
    const allSources = [
      ...mockExternalSources,
      ...retrievalResult.filtered_personal_materials.map((m: any) => ({
        id: m.id,
        title: m.title || '个人资料',
        content: m.content,
        summary: m.content.substring(0, 200),
        source_url: null,
        source_type: 'personal',
        credibility_score: 0.9,
        recency_score: 0.5,
        relevance_score: 0.8,
        token_length: m.content.length,
        tags: m.tags || [],
        created_at: m.created_at
      }))
    ];

    // 批量插入
    const { error: insertError } = await supabase
      .from('research_sources')
      .insert(
        allSources.map(source => ({
          project_id,
          title: source.title,
          content: source.content,
          summary: source.summary,
          source_url: source.source_url,
          source_type: source.source_type,
          credibility_score: source.credibility_score,
          recency_score: source.recency_score,
          relevance_score: source.relevance_score,
          token_length: source.token_length,
          tags: source.tags
        }))
      );

    if (insertError) {
      console.error('[research-retrieval] 保存失败:', insertError);
      throw insertError;
    }

    // 6. 记录 agent 日志
    await supabase.from('agent_logs').insert({
      project_id,
      agent_name: 'researchAgent.retrieval',
      input_payload_jsonb: {
        writing_brief_topic: writing_brief.topic,
        personal_materials_count: personalMaterials?.length || 0
      },
      output_payload_jsonb: {
        total_sources: allSources.length,
        external_sources: mockExternalSources.length,
        personal_sources: retrievalResult.filtered_personal_materials.length
      },
      latency_ms: latency,
      status: 'success'
    });

    console.log('[research-retrieval] 资料已保存，总数:', allSources.length);

    return new Response(
      JSON.stringify({
        success: true,
        total_sources: allSources.length,
        external_sources: mockExternalSources.length,
        personal_sources: retrievalResult.filtered_personal_materials.length,
        search_queries: retrievalResult.search_queries
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[research-retrieval] 错误:', error);
    
    // 记录错误日志
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      const { project_id } = await req.json();
      if (project_id) {
        await supabase.from('agent_logs').insert({
          project_id,
          agent_name: 'researchAgent.retrieval',
          status: 'error',
          error_message: error instanceof Error ? error.message : String(error)
        });
      }
    } catch (logError) {
      console.error('[research-retrieval] 记录错误日志失败:', logError);
    }
    
    return new Response(
      JSON.stringify({
        error: 'Research Retrieval 运行失败',
        details: error instanceof Error ? error.message : String(error)
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
