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

    // 获取用户配置
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('llm_api_key, llm_provider')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: '无法获取用户配置' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!profile.llm_api_key || !profile.llm_provider) {
      return new Response(
        JSON.stringify({ error: '请先在设置中配置 LLM API 密钥和提供商' }),
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
    
    if (profile.llm_provider === 'openai') {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${profile.llm_api_key}`,
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
    } else if (profile.llm_provider === 'anthropic') {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': profile.llm_api_key,
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
    } else {
      return new Response(
        JSON.stringify({ error: `不支持的 LLM 提供商: ${profile.llm_provider}` }),
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
