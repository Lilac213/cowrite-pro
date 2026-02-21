import { supabase } from '@/db/supabase';
import type { WritingSession, WritingStage, ResearchInsight, ResearchGap, UserDecision } from '@/types';

const supabaseClient = supabase as any;

export async function getOrCreateWritingSession(projectId: string, userId?: string): Promise<WritingSession> {
  const { data: existing, error: fetchError } = await supabaseClient
    .from('writing_sessions')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (existing) return existing as WritingSession;

  const { data, error } = await supabaseClient
    .from('writing_sessions')
    .insert({
      project_id: projectId,
      user_id: userId,
      current_stage: 'research',
      locked_core_thesis: false,
      locked_structure: false,
    } as any)
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      const { data: retry, error: retryError } = await supabaseClient
        .from('writing_sessions')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      if (retryError) throw retryError;
      return retry as WritingSession;
    }
    throw error;
  }
  return data as WritingSession;
}

export async function getWritingSession(projectId: string): Promise<WritingSession | null> {
  const { data, error } = await supabaseClient
    .from('writing_sessions')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as WritingSession | null;
}

export async function updateWritingSessionStage(sessionId: string, stage: WritingStage) {
  const { error } = await supabaseClient
    .from('writing_sessions')
    .update({ current_stage: stage, updated_at: new Date().toISOString() })
    .eq('id', sessionId);
  if (error) throw error;
}

export async function getResearchInsights(sessionId: string): Promise<ResearchInsight[]> {
  const { data, error } = await supabaseClient
    .from('research_insights')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (Array.isArray(data) ? data : []) as ResearchInsight[];
}

export async function getResearchGaps(sessionId: string): Promise<ResearchGap[]> {
  const { data, error } = await supabaseClient
    .from('research_gaps')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (Array.isArray(data) ? data : []) as ResearchGap[];
}

export async function updateInsightDecision(insightId: string, decision: UserDecision) {
  const { error } = await supabaseClient
    .from('research_insights')
    .update({ user_decision: decision })
    .eq('id', insightId);
  if (error) throw error;
}

export async function updateGapDecision(gapId: string, decision: 'respond' | 'ignore') {
  const { error } = await supabaseClient
    .from('research_gaps')
    .update({ user_decision: decision })
    .eq('id', gapId);
  if (error) throw error;
}

export async function saveResearchInsight(insight: Partial<ResearchInsight>) {
  const { error } = await supabaseClient
    .from('research_insights')
    .upsert(insight, { onConflict: 'id' });
  if (error) throw error;
}

export async function saveResearchGap(gap: Partial<ResearchGap>) {
  const { error } = await supabaseClient
    .from('research_gaps')
    .upsert(gap, { onConflict: 'id' });
  if (error) throw error;
}
