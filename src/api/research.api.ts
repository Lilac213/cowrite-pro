import { supabase } from '@/db/supabase';

export async function researchRetrievalAgent(requirementsDoc: any, projectId?: string, userId?: string, sessionId?: string) {
  const { data, error } = await supabase.functions.invoke('research-retrieval-agent', {
    body: { requirementsDoc, projectId, userId, sessionId },
  });

  if (error) {
    let errorMessage = error.message || '资料检索失败';
    if (error.context) {
      try {
        const contextText = typeof error.context === 'string' ? error.context : await error.context.text?.();
        if (contextText) {
          try {
            const contextJson = JSON.parse(contextText);
            errorMessage = contextJson.error || contextText;
          } catch {
            errorMessage = contextText;
          }
        }
      } catch (e) {
        console.error('提取错误上下文失败:', e);
      }
    }
    if (data && typeof data === 'object' && 'error' in data) {
      errorMessage = data.error;
    }
    throw new Error(errorMessage);
  }

  if (!data) throw new Error('资料检索返回数据为空');
  if (data.success && data.data) {
    return { ...data.data, logs: data.logs || [] };
  }
  return data;
}

export async function callResearchSynthesisAgent(projectIdOrInput: string | any, sessionId?: string) {
  let body: any;
  if (typeof projectIdOrInput === 'string') {
    body = { projectId: projectIdOrInput, sessionId };
  } else {
    body = { input: projectIdOrInput, sessionId };
  }
  
  const { data, error } = await supabase.functions.invoke('research-synthesis-agent', { body });

  if (error) {
    let errorMessage = error.message || '资料整理失败';
    if (error.context) {
      try {
        const contextText = typeof error.context === 'string' ? error.context : await error.context.text();
        if (contextText) {
          try {
            const errorData = JSON.parse(contextText);
            throw new Error(
              `资料整理失败: ${errorData.error || error.message}\n` +
              `详情: ${errorData.details ? JSON.stringify(errorData.details, null, 2) : '无'}\n` +
              `时间: ${errorData.timestamp || '未知'}`
            );
          } catch (parseError) {
            throw new Error(`资料整理失败: ${contextText || error.message}`);
          }
        }
      } catch (textError) {
        console.error('无法读取上下文文本:', textError);
      }
    }
    throw new Error(`资料整理失败: ${error.message || 'Edge Function 调用失败'}`);
  }
  
  if (sessionId && data) {
    try {
      await supabase
        .from('writing_sessions')
        .update({
          synthesis_result: {
            thought: data.thought,
            input: body.input || { projectId: body.projectId },
            synthesis: data.synthesis,
            timestamp: new Date().toISOString()
          },
          updated_at: new Date().toISOString()
        } as any)
        .eq('id', sessionId);
    } catch (saveError) {
      console.error('保存 synthesis_result 异常:', saveError);
    }
  }
  
  return data;
}
