import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 获取用户认证信息
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: '未授权' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 获取系统配置（从 system_config 表读取）
    const { data: configs, error: configError } = await supabaseClient
      .from('system_config')
      .select('config_key, config_value')
      .in('config_key', ['llm_provider', 'llm_api_key']);

    if (configError) {
      return new Response(
        JSON.stringify({ error: '无法获取系统配置' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const configMap = configs.reduce((acc, item) => {
      acc[item.config_key] = item.config_value;
      return acc;
    }, {} as Record<string, string>);

    const llmProvider = configMap['llm_provider'];
    const llmApiKey = configMap['llm_api_key'];

    if (!llmApiKey || !llmProvider) {
      return new Response(
        JSON.stringify({ error: '系统 LLM 配置未完成，请联系管理员配置' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 解析请求体
    const { prompt, context, systemMessage } = await req.json();

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: '缺少 prompt 参数' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 根据提供商调用不同的 API
    let result = '';
    
    if (llmProvider === 'qwen') {
      // 通义千问 API
      const response = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${llmApiKey}`,
        },
        body: JSON.stringify({
          model: 'qwen-plus',
          input: {
            messages: [
              ...(systemMessage ? [{ role: 'system', content: systemMessage }] : []),
              ...(context ? [{ role: 'user', content: context }] : []),
              { role: 'user', content: prompt },
            ],
          },
          parameters: {
            temperature: 0.7,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`通义千问 API 错误: ${error}`);
      }

      const data = await response.json();
      result = data.output?.text || data.output?.choices?.[0]?.message?.content || '';
      
      // 清理可能的 markdown 代码块标记
      result = result.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    } else if (llmProvider === 'openai') {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${llmApiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            ...(systemMessage ? [{ role: 'system', content: systemMessage }] : []),
            ...(context ? [{ role: 'user', content: context }] : []),
            { role: 'user', content: prompt },
          ],
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API 错误: ${error}`);
      }

      const data = await response.json();
      result = data.choices[0].message.content;
      
      // 清理可能的 markdown 代码块标记
      result = result.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    } else if (llmProvider === 'anthropic') {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': llmApiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 4096,
          system: systemMessage || '',
          messages: [
            ...(context ? [{ role: 'user', content: context }] : []),
            { role: 'user', content: prompt },
          ],
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Anthropic API 错误: ${error}`);
      }

      const data = await response.json();
      result = data.content[0].text;
      
      // 清理可能的 markdown 代码块标记
      result = result.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    } else {
      return new Response(
        JSON.stringify({ error: `不支持的 LLM 提供商: ${llmProvider}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
