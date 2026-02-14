import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InviteRequest {
  email: string;
  inviteCode: string;
  credits: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: '缺少授权信息' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError || !user) {
      console.error('认证错误:', authError);
      return new Response(
        JSON.stringify({ error: '未授权', details: authError?.message }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: profile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: '无权限，仅管理员可发送邀请' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { email, inviteCode, credits }: InviteRequest = await req.json();

    if (!email || !inviteCode) {
      return new Response(
        JSON.stringify({ error: '邮箱和邀请码不能为空' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: codeData } = await adminClient
      .from('invitation_codes')
      .select('*')
      .eq('code', inviteCode)
      .eq('is_active', true)
      .single();

    if (!codeData) {
      return new Response(
        JSON.stringify({ error: '邀请码无效或已停用' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const siteUrl = Deno.env.get('SITE_URL') || 'https://www.cowrite.top';
    const registerUrl = `${siteUrl}/login`;

    const emailContent = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>CoWrite 邀请</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
          <tr>
            <td style="background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); padding: 40px 40px 30px; border-radius: 16px 16px 0 0; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">CoWrite</h1>
              <p style="margin: 8px 0 0; color: rgba(255, 255, 255, 0.9); font-size: 14px;">智能写作辅助平台</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; color: #1f2937; font-size: 24px; font-weight: 600;">您好！</h2>
              <p style="margin: 0 0 24px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                您收到一封来自 CoWrite 的邀请，加入我们的智能写作辅助平台！
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 32px;">
                <tr>
                  <td style="padding: 24px; background: linear-gradient(135deg, #f0f9ff 0%, #fdf4ff 100%); border-radius: 12px; border: 1px solid #e0e7ff;">
                    <p style="margin: 0 0 16px; color: #374151; font-size: 14px; text-align: center;">
                      使用以下邀请码注册可获得
                    </p>
                    <p style="margin: 0 0 16px; color: #4F46E5; font-size: 32px; font-weight: 700; text-align: center;">
                      ${credits} 点数
                    </p>
                    <p style="margin: 0 0 8px; color: #6b7280; font-size: 12px; text-align: center;">
                      您的专属邀请码
                    </p>
                    <p style="margin: 0; padding: 12px; background-color: #ffffff; border-radius: 8px; font-family: 'Courier New', monospace; font-size: 24px; font-weight: 700; letter-spacing: 4px; text-align: center; color: #1f2937; border: 2px dashed #4F46E5;">
                      ${inviteCode}
                    </p>
                  </td>
                </tr>
              </table>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 32px;">
                <tr>
                  <td style="padding: 20px; background-color: #f9fafb; border-radius: 12px;">
                    <p style="margin: 0 0 12px; color: #374151; font-size: 14px; font-weight: 600;">✨ 您将获得以下功能：</p>
                    <ul style="margin: 0; padding-left: 20px; color: #6b7280; font-size: 14px; line-height: 1.8;">
                      <li>AI 智能写作辅助</li>
                      <li>学术文献自动检索</li>
                      <li>多轮内容审校</li>
                      <li>一键导出专业文档</li>
                    </ul>
                  </td>
                </tr>
              </table>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="padding-bottom: 24px;">
                    <a href="${registerUrl}" style="display: inline-block; background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); color: #ffffff; padding: 16px 48px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600;">
                      立即注册
                    </a>
                  </td>
                </tr>
              </table>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                <tr>
                  <td style="padding: 16px; background-color: #f0fdf4; border-radius: 8px;">
                    <p style="margin: 0 0 8px; color: #166534; font-size: 13px; font-weight: 600;">📝 注册步骤：</p>
                    <ol style="margin: 0; padding-left: 20px; color: #15803d; font-size: 13px; line-height: 1.8;">
                      <li>点击上方按钮进入注册页面</li>
                      <li>填写用户名、邮箱和密码</li>
                      <li>在邀请码栏输入上述邀请码</li>
                      <li>验证邮箱后即可使用</li>
                    </ol>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 40px; background-color: #f9fafb; border-radius: 0 0 16px 16px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 8px; color: #9ca3af; font-size: 12px; text-align: center;">
                如果您没有请求此邀请，请忽略此邮件。
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 12px; text-align: center;">
                © 2026 CoWrite. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const resendKey = Deno.env.get('RESEND_API_KEY');
    
    if (!resendKey) {
      throw new Error('邮件服务未配置，请联系管理员');
    }

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'CoWrite <noreply@cowrite.top>',
        to: email,
        subject: '您收到一封来自 CoWrite 的邀请',
        html: emailContent,
      }),
    });

    if (!resendResponse.ok) {
      const resendError = await resendResponse.text();
      console.error('Resend 发送失败:', resendError);
      throw new Error(`邮件发送失败: ${resendError}`);
    }

    const resendResult = await resendResponse.json();
    console.log('邮件发送成功:', resendResult);

    return new Response(
      JSON.stringify({ success: true, message: '邀请邮件已发送', emailId: resendResult.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('发送邀请失败:', error);
    return new Response(
      JSON.stringify({ error: error.message || '发送失败' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
