import { apiJson } from './http';

export async function generateIssues(params: {
  document_id: string;
  content: string;
  paragraph_id?: string;
  selection?: string;
  agent?: 'live' | 'coach';
  stage?: 'draft' | 'argument' | 'refine';
}) {
  return apiJson('/issues/generate', params, true);
}

export async function getActiveIssues(document_id: string) {
  return apiJson(`/issues/active?document_id=${encodeURIComponent(document_id)}`);
}

export async function applyIssue(params: {
  document_id: string;
  issue_id: string;
  content: string;
}) {
  return apiJson('/issues/apply', params, true);
}

export async function ignoreIssue(params: { document_id: string; issue_id: string }) {
  return apiJson('/issues/ignore', params, true);
}

export async function resolveDecisionGuide(params: {
  document_id: string;
  content: string;
  issues: Array<{ type: string; severity: string; suggestion_text: string }>;
  mode?: 'normal' | 'auto_fix';
}) {
  return apiJson('/decision-guide/resolve', params, true);
}
