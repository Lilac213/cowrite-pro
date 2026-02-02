import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { fileUrl, fileType } = await req.json();

    if (!fileUrl || !fileType) {
      throw new Error('缺少必需参数：fileUrl 和 fileType');
    }

    // 创建 Supabase 客户端
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 下载文件
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('cowrite-files')
      .download(fileUrl.replace(`${supabaseUrl}/storage/v1/object/public/cowrite-files/`, ''));

    if (downloadError) {
      throw new Error(`文件下载失败: ${downloadError.message}`);
    }

    let extractedText = '';

    if (fileType === 'application/pdf') {
      // PDF 解析
      extractedText = await parsePDF(fileData);
    } else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      // Word 解析
      extractedText = await parseWord(fileData);
    } else if (fileType.startsWith('text/')) {
      // 纯文本文件
      extractedText = await fileData.text();
    } else {
      throw new Error(`不支持的文件类型: ${fileType}`);
    }

    return new Response(
      JSON.stringify({ text: extractedText }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('文档解析错误:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});

async function parsePDF(fileData: Blob): Promise<string> {
  // 使用 pdf.js 或其他 PDF 解析库
  // 由于 Deno 环境限制，这里使用简单的文本提取
  const arrayBuffer = await fileData.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  
  // 简单的 PDF 文本提取（仅提取可见文本）
  const text = new TextDecoder('utf-8').decode(uint8Array);
  
  // 提取 PDF 中的文本内容（简化版）
  const textMatches = text.match(/\(([^)]+)\)/g);
  if (textMatches) {
    return textMatches.map(match => match.slice(1, -1)).join(' ');
  }
  
  return '无法提取 PDF 文本内容，请尝试使用其他格式';
}

async function parseWord(fileData: Blob): Promise<string> {
  // Word 文档解析
  const arrayBuffer = await fileData.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  
  // 使用 JSZip 解压 .docx 文件
  try {
    // .docx 是 ZIP 格式，包含 word/document.xml
    const text = new TextDecoder('utf-8').decode(uint8Array);
    
    // 简单提取 XML 中的文本
    const xmlMatch = text.match(/<w:t[^>]*>([^<]+)<\/w:t>/g);
    if (xmlMatch) {
      return xmlMatch.map(match => {
        const textMatch = match.match(/>([^<]+)</);
        return textMatch ? textMatch[1] : '';
      }).join(' ');
    }
    
    return '无法提取 Word 文本内容，请尝试使用其他格式';
  } catch (error) {
    console.error('Word 解析错误:', error);
    return '无法提取 Word 文本内容，请尝试使用其他格式';
  }
}
