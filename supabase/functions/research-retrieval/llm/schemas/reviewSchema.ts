/**
 * Review Agent Schema
 * 审校层 Payload 格式定义
 */

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
  // 新增：结构化问题列表
  logic_issues: Issue[];
  citation_issues: Issue[];
  style_issues: Issue[];
  grammar_issues: Issue[];
  
  // 新增：冗余度评分
  redundancy_score: number;  // 0-1，越高越冗余
  
  // 新增：改写建议
  suggested_rewrites: SuggestedRewrite[];
  
  // 新增：整体评估
  overall_quality: {
    logic_score: number;      // 0-1
    citation_score: number;   // 0-1
    style_score: number;      // 0-1
    grammar_score: number;    // 0-1
    overall_score: number;    // 0-1
  };
  
  // 新增：是否通过审校
  pass: boolean;
  
  // 元数据
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
    // 验证所有 issues 数组
    if (!Array.isArray(data.logic_issues) ||
        !Array.isArray(data.citation_issues) ||
        !Array.isArray(data.style_issues) ||
        !Array.isArray(data.grammar_issues)) {
      return false;
    }
    
    // 验证每个 issue
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
    
    // 验证 suggested_rewrites
    if (!Array.isArray(data.suggested_rewrites)) {
      return false;
    }
    
    for (const rewrite of data.suggested_rewrites) {
      if (!rewrite.block_id || !rewrite.original_text || !rewrite.suggested_text || !rewrite.reason) {
        return false;
      }
    }
    
    // 验证 overall_quality
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
    
    // 验证 pass
    if (typeof data.pass !== 'boolean') {
      return false;
    }
    
    // 验证 redundancy_score
    if (typeof data.redundancy_score !== 'number') {
      return false;
    }
    
    return true;
  }
};
