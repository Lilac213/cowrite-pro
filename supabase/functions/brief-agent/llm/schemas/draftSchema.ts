/**
 * Draft Agent Schema
 * 草稿生成层 Payload 格式定义
 */

export interface Citation {
  source_id: string;
  source_url?: string;
  source_title: string;
  quote?: string;
  citation_type: 'direct' | 'paraphrase' | 'reference';
  citation_display: string;  // 例如：（见资料3）
}

export interface DraftBlock {
  block_id: string;
  paragraph_id: string;
  content: string;
  
  // 新增：来源追溯
  derived_from: string[];  // insight IDs
  
  // 新增：引用信息
  citations: Citation[];
  
  // 新增：质量指标
  coherence_score: number;  // 0-1
  requires_user_input: boolean;
  
  order: number;
}

export interface DraftPayload {
  // 新增：结构化草稿块
  draft_blocks: DraftBlock[];
  
  // 新增：全局质量指标
  global_coherence_score: number;
  
  // 新增：缺失证据提示
  missing_evidence_blocks: string[];  // block IDs
  
  // 新增：修订建议
  needs_revision: boolean;
  revision_notes?: string[];
  
  // 元数据
  total_word_count: number;
  created_at: string;
}

export const draftSchema = {
  required: [
    'draft_blocks',
    'global_coherence_score',
    'missing_evidence_blocks',
    'needs_revision',
    'total_word_count'
  ],
  validate: (data: any) => {
    if (!Array.isArray(data.draft_blocks)) {
      return false;
    }
    
    // 验证每个 block 必需字段
    for (const block of data.draft_blocks) {
      if (!block.block_id || !block.paragraph_id || !block.content) {
        return false;
      }
      
      // 必须有来源追溯
      if (!Array.isArray(block.derived_from)) {
        return false;
      }
      
      // 必须有引用信息（即使为空数组）
      if (!Array.isArray(block.citations)) {
        return false;
      }
      
      // 验证每个 citation
      for (const citation of block.citations) {
        if (!citation.source_id || !citation.citation_type || !citation.citation_display) {
          return false;
        }
      }
      
      // 必须有 coherence_score
      if (typeof block.coherence_score !== 'number') {
        return false;
      }
    }
    
    // 验证全局指标
    if (typeof data.global_coherence_score !== 'number') {
      return false;
    }
    
    if (!Array.isArray(data.missing_evidence_blocks)) {
      return false;
    }
    
    if (typeof data.needs_revision !== 'boolean') {
      return false;
    }
    
    return true;
  }
};
