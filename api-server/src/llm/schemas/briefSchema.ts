export interface WritingBrief {
  topic: string;
  user_core_thesis: string;
  confirmed_insights: string[];
  requirement_meta: {
    document_type: 'academic' | 'blog' | 'report' | 'speech' | 'article';
    target_audience: string;
    writing_depth: '浅' | '中' | '深';
    citation_style: 'APA' | 'MLA' | 'Chicago' | 'none';
    language: string;
    max_word_count: number;
    seo_mode: boolean;
    tone: string;
  };
  style?: string;
  keywords?: string[];
  background_context?: string;
}

export const briefSchema = {
  required: [
    'topic',
    'user_core_thesis',
    'confirmed_insights',
    'requirement_meta'
  ],
  optional: ['style', 'keywords', 'background_context'],
  validate: (data: any) => {
    if (!data.requirement_meta) return false;
    const meta = data.requirement_meta;
    return !!(
      meta.document_type &&
      meta.target_audience &&
      meta.writing_depth &&
      meta.citation_style &&
      meta.language &&
      typeof meta.max_word_count === 'number' &&
      typeof meta.seo_mode === 'boolean' &&
      meta.tone
    );
  }
};
