export interface ResearchSource {
  id: string;
  title: string;
  content: string;
  summary: string;
  source_url?: string;
  source_type: 'web' | 'personal' | 'academic' | 'news';
  credibility_score: number;
  recency_score: number;
  relevance_score: number;
  token_length: number;
  chunk_index?: number;
  tags?: string[];
  created_at: string;
}

export interface SynthesizedInsight {
  id: string;
  category: string;
  content: string;
  supporting_source_ids: string[];
  references?: Array<{
    id: string;
    title: string;
    url?: string;
  }>;
  citability: 'direct' | 'paraphrase' | 'background';
  evidence_strength: 'strong' | 'medium' | 'weak';
  risk_flag: boolean;
  confidence_score: number;
  user_decision?: 'confirmed' | 'ignored' | 'pending';
}

export interface ResearchPack {
  sources: ResearchSource[];
  insights: SynthesizedInsight[];
  summary: {
    total_sources: number;
    total_insights: number;
    coverage_score: number;
    quality_score: number;
  };
}

export const researchPackSchema = {
  required: ['sources', 'insights', 'summary'],
  validate: (data: any) => {
    if (!Array.isArray(data.sources) || !Array.isArray(data.insights)) {
      return false;
    }

    for (const source of data.sources) {
      if (!source.id || !source.title || !source.content) return false;
      if (typeof source.credibility_score !== 'number') return false;
      if (typeof source.recency_score !== 'number') return false;
      if (typeof source.relevance_score !== 'number') return false;
      if (typeof source.token_length !== 'number') return false;
    }

    for (const insight of data.insights) {
      if (!insight.id || !insight.category || !insight.content) return false;
      if (!Array.isArray(insight.supporting_source_ids)) return false;
      if (!insight.citability || !insight.evidence_strength) return false;
      if (typeof insight.confidence_score !== 'number') return false;
    }

    return true;
  }
};
