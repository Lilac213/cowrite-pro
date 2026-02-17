export interface Issue {
  block_id?: string;
  paragraph_id?: string;
  issue_type: string;
  severity: 'high' | 'medium' | 'low';
  description: string;
  suggestion?: string;
  location?: {
    start: number;
    end: number;
  };
}

export interface SuggestedRewrite {
  block_id: string;
  original_text: string;
  suggested_text: string;
  reason: string;
}

export interface ReviewPayload {
  logic_issues: Issue[];
  citation_issues: Issue[];
  style_issues: Issue[];
  grammar_issues: Issue[];
  redundancy_score: number;
  suggested_rewrites: SuggestedRewrite[];
  overall_quality: {
    logic_score: number;
    citation_score: number;
    style_score: number;
    grammar_score: number;
    overall_score: number;
  };
  pass: boolean;
  review_notes?: string;
  created_at: string;
}

export const reviewSchema = {
  required: [
    'logic_issues',
    'citation_issues',
    'style_issues',
    'grammar_issues',
    'redundancy_score',
    'suggested_rewrites',
    'overall_quality',
    'pass'
  ],
  validate: (data: any) => {
    if (!Array.isArray(data.logic_issues) ||
        !Array.isArray(data.citation_issues) ||
        !Array.isArray(data.style_issues) ||
        !Array.isArray(data.grammar_issues)) {
      return false;
    }

    const allIssues = [
      ...data.logic_issues,
      ...data.citation_issues,
      ...data.style_issues,
      ...data.grammar_issues
    ];

    for (const issue of allIssues) {
      if (!issue.issue_type || !issue.severity || !issue.description) {
        return false;
      }
      if (!['high', 'medium', 'low'].includes(issue.severity)) {
        return false;
      }
    }

    if (!Array.isArray(data.suggested_rewrites)) {
      return false;
    }

    for (const rewrite of data.suggested_rewrites) {
      if (!rewrite.block_id || !rewrite.original_text || !rewrite.suggested_text || !rewrite.reason) {
        return false;
      }
    }

    if (!data.overall_quality) {
      return false;
    }

    const quality = data.overall_quality;
    if (typeof quality.logic_score !== 'number' ||
        typeof quality.citation_score !== 'number' ||
        typeof quality.style_score !== 'number' ||
        typeof quality.grammar_score !== 'number' ||
        typeof quality.overall_score !== 'number') {
      return false;
    }

    if (typeof data.pass !== 'boolean') {
      return false;
    }

    if (typeof data.redundancy_score !== 'number') {
      return false;
    }

    return true;
  }
};
