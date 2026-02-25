import { randomUUID } from 'crypto';

export type IssueType = 'grammar' | 'clarity' | 'structure' | 'logic' | 'argument';
export type IssueSeverity = 'low' | 'medium' | 'high';
export type IssueScope = 'sentence' | 'paragraph' | 'document';
export type IssueSource = 'live' | 'coach' | 'decision';
export type IssueStatus = 'active' | 'ignored' | 'resolved';

export interface Issue {
  id: string;
  type: IssueType;
  severity: IssueSeverity;
  scope: IssueScope;
  source_agent: IssueSource;
  suggestion_text: string;
  suggested_fix?: string;
  target_text?: string;
  paragraph_id?: string;
  status: IssueStatus;
  cooldown_until?: number;
  priority_score: number;
  created_at: number;
}

export interface Version {
  id: string;
  document_id: string;
  applied_issue_id: string;
  diff: {
    before: string;
    after: string;
  };
  full_snapshot: string;
  timestamp: number;
}

interface DocumentState {
  issues: Issue[];
  versions: Version[];
  ignore_count: number;
}

const documents = new Map<string, DocumentState>();

function getDocumentState(documentId: string): DocumentState {
  if (!documents.has(documentId)) {
    documents.set(documentId, { issues: [], versions: [], ignore_count: 0 });
  }
  return documents.get(documentId)!;
}

const severityWeight: Record<IssueSeverity, number> = {
  low: 1,
  medium: 2,
  high: 3
};

const scopeWeight: Record<IssueScope, number> = {
  sentence: 1,
  paragraph: 2,
  document: 3
};

export function buildIssue(input: Omit<Issue, 'id' | 'status' | 'priority_score' | 'created_at'>): Issue {
  const base = severityWeight[input.severity] * 3 + scopeWeight[input.scope] * 2;
  const priority = Math.max(1, base);
  return {
    ...input,
    id: randomUUID(),
    status: 'active',
    priority_score: priority,
    created_at: Date.now()
  };
}

export function addIssues(documentId: string, issues: Issue[]) {
  const state = getDocumentState(documentId);
  state.issues.push(...issues);
  const typeCounts = state.issues.reduce<Record<string, number>>((acc, issue) => {
    if (issue.status !== 'active') return acc;
    acc[issue.type] = (acc[issue.type] || 0) + 1;
    return acc;
  }, {});
  state.issues = state.issues.map(issue => {
    if (issue.status !== 'active') return issue;
    const repetition = typeCounts[issue.type] || 1;
    const ignorePenalty = state.ignore_count * 0.3;
    return {
      ...issue,
      priority_score: issue.priority_score + repetition - ignorePenalty
    };
  });
}

export function getActiveIssues(documentId: string) {
  const state = getDocumentState(documentId);
  const now = Date.now();
  const lowIntervention = state.ignore_count > 5;
  const active = state.issues.filter(issue => {
    if (issue.status !== 'active') return false;
    if (issue.cooldown_until && issue.cooldown_until > now) return false;
    if (lowIntervention && issue.severity !== 'high') return false;
    return true;
  });

  active.sort((a, b) => b.priority_score - a.priority_score);

  const scopeCounts: Record<IssueScope, number> = {
    sentence: 0,
    paragraph: 0,
    document: 0
  };
  const limited: Issue[] = [];

  for (const issue of active) {
    if (limited.length >= 3) break;
    if (issue.scope === 'sentence' && scopeCounts.sentence >= 2) continue;
    if (issue.scope === 'paragraph' && scopeCounts.paragraph >= 2) continue;
    if (issue.scope === 'document' && scopeCounts.document >= 1) continue;
    scopeCounts[issue.scope] += 1;
    limited.push(issue);
  }

  return {
    issues: limited,
    low_intervention: lowIntervention,
    ignore_count: state.ignore_count
  };
}

export function ignoreIssue(documentId: string, issueId: string) {
  const state = getDocumentState(documentId);
  const now = Date.now();
  state.ignore_count += 1;
  state.issues = state.issues.map(issue =>
    issue.id === issueId
      ? { ...issue, status: 'ignored', cooldown_until: now + 180000 }
      : issue
  );
}

export function resolveIssue(documentId: string, issueId: string) {
  const state = getDocumentState(documentId);
  state.issues = state.issues.map(issue =>
    issue.id === issueId ? { ...issue, status: 'resolved' } : issue
  );
}

export function saveVersion(documentId: string, issueId: string, before: string, after: string) {
  const state = getDocumentState(documentId);
  const version: Version = {
    id: randomUUID(),
    document_id: documentId,
    applied_issue_id: issueId,
    diff: { before, after },
    full_snapshot: before,
    timestamp: Date.now()
  };
  state.versions.push(version);
  return version;
}

export function findIssue(documentId: string, issueId: string) {
  const state = getDocumentState(documentId);
  return state.issues.find(issue => issue.id === issueId) || null;
}

export function listVersions(documentId: string) {
  return getDocumentState(documentId).versions;
}

export function getVersion(documentId: string, versionId: string) {
  return getDocumentState(documentId).versions.find(version => version.id === versionId) || null;
}
