import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { runStructureAdjustmentAgent } from './llm/agents/structureAdjustmentAgent.ts';

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

    const { project_id, coreThesis, argumentBlocks, operation, blockIndex } = await req.json();

    if (!coreThesis || !argumentBlocks) {
      return new Response(
        JSON.stringify({ error: '缺少核心论点或论证块信息' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[adjust-article-structure] 开始调整结构，operation:', operation);
    const startTime = Date.now();

    const result = await runStructureAdjustmentAgent({
      core_thesis: coreThesis,
      argument_blocks: argumentBlocks,
      operation,
      block_index: blockIndex
    });

    const adjustedData = result.data;
    const latency = Date.now() - startTime;

    console.log('[adjust-article-structure] 验证返回结构');
    console.log('[adjust-article-structure] 返回数据类型:', typeof adjustedData);
    console.log('[adjust-article-structure] 返回数据内容:', JSON.stringify(adjustedData, null, 2));
    
    const missingFields = [];
    if (!adjustedData.core_thesis) missingFields.push('core_thesis');
    if (!adjustedData.argument_blocks) missingFields.push('argument_blocks');
    
    if (missingFields.length > 0) {
      console.error('[adjust-article-structure] ❌ 返回的结构缺少必要字段:', missingFields.join(', '));
      console.error('[adjust-article-structure] 实际字段列表:', Object.keys(adjustedData).join(', '));
      console.error('[adjust-article-structure] 完整结构内容:', JSON.stringify(adjustedData, null, 2));
      throw new Error(`返回的结构缺少必要字段: ${missingFields.join(', ')}。实际字段: ${Object.keys(adjustedData).join(', ')}`);
    }

    // 确保保留原始的block id，并为新增的块生成新ID
    if (argumentBlocks && Array.isArray(argumentBlocks)) {
      const timestamp = Date.now();
      adjustedData.argument_blocks = adjustedData.argument_blocks.map((block: any, index: number) => {
        // 尝试通过标题匹配原始块
        const matchedOriginal = argumentBlocks.find((orig: any) => 
          orig.title === block.title || orig.description === block.description
        );
        
        // 如果找到匹配的原始块，保留其ID；否则生成新ID
        const blockId = matchedOriginal?.id || `block_${timestamp}_${index}`;
        
        return {
          ...block,
          id: blockId,
          order: index + 1,
        };
      });
    }

    // 记录 agent 日志（如果有 project_id）
    if (project_id) {
      await supabase.from('agent_logs').insert({
        project_id,
        agent_name: 'structureAdjustmentAgent',
        input_payload_jsonb: { coreThesis, argumentBlocks, operation, blockIndex },
        output_payload_jsonb: adjustedData,
        latency_ms: latency,
        status: 'success'
      });
    }

    return new Response(
      JSON.stringify(adjustedData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[adjust-article-structure] 错误:', error);
    
    return new Response(
      JSON.stringify({ 
        error: '调整结构失败',
        details: error instanceof Error ? error.message : String(error)
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
