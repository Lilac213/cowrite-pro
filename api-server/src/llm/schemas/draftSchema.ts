export interface Citation {
  source_id: string;
  source_url?: string;
  source_title: string;
  source_abstract?: string;
  quote?: string;
  citation_type: 'direct' | 'paraphrase' | 'reference';
  citation_display: string;
  relevance_score?: number;
}

export interface DraftBlock {
  block_id: string;
  paragraph_id: string;
  content: string;
  derived_from: string[];
  citations: Citation[];
  coherence_score: number;
  requires_user_input: boolean;
  order: number;
  coaching_tip?: {
    rationale: string;
    suggestion: string;
  };
}

export interface DraftPayload {
  draft_blocks: DraftBlock[];
  global_coherence_score: number;
  missing_evidence_blocks: string[];
  needs_revision: boolean;
  revision_notes?: string[];
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

    for (const block of data.draft_blocks) {
      if (!block.block_id || !block.paragraph_id || !block.content) {
        return false;
      }

      if (!Array.isArray(block.derived_from)) {
        return false;
      }

      if (!Array.isArray(block.citations)) {
        return false;
      }

      for (const citation of block.citations) {
        if (!citation.source_id || !citation.citation_type || !citation.citation_display || !citation.source_title) {
          return false;
        }
      }

      if (typeof block.coherence_score !== 'number') {
        return false;
      }
      
      // coaching_tip is optional but if present must have rationale and suggestion
      if (block.coaching_tip) {
        if (!block.coaching_tip.rationale || !block.coaching_tip.suggestion) {
          return false;
        }
      }
    }

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
