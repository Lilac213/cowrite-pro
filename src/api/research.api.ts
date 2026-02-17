import { supabase } from '@/db/supabase';
import { apiJson, apiSSE } from './http';

const supabaseClient = supabase as any;

export async function researchRetrievalAgent(requirementsDoc: any, projectId?: string, userId?: string, sessionId?: string): Promise<any> {
  return apiSSE<any>('/api/search/stream', { requirementsDoc, projectId, userId, sessionId });
}

export async function callResearchSynthesisAgent(projectIdOrInput: string | any, sessionId?: string) {
  let body: any;
  if (typeof projectIdOrInput === 'string') {
    body = { projectId: projectIdOrInput, sessionId };
  } else {
    body = { input: projectIdOrInput, sessionId };
  }
  
  const data = await apiJson<any>('/api/research-synthesis-agent', body);
  if (sessionId && data) {
    try {
      await supabaseClient
        .from('writing_sessions')
        .update({
          synthesis_result: {
            thought: data.thought,
            input: body.input || { projectId: body.projectId },
            synthesis: data.synthesis,
            timestamp: new Date().toISOString()
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId);
    } catch (saveError) {
      console.error('保存 synthesis_result 异常:', saveError);
    }
  }
  return data;
}
