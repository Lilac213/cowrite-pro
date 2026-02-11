/**
 * Research Agent Schema
 * 资料搜索与整理层 Payload 格式定义
 */

// 资料搜索结果
export interface ResearchSource {
  id: string;
  title: string;
  content: string;
  summary: string;
  source_url?: string;
  source_type: 'web' | 'personal' | 'academic' | 'news';
  
  // 新增：评分字段
  credibility_score: number;  // 0-1
  recency_score: number;      // 0-1
  relevance_score: number;    // 0-1
  
  // 新增：技术字段
  token_length: number;
  chunk_index?: number;
  
  tags?: string[];
  created_at: string;
}

// 资料整理结果（洞察）
export interface SynthesizedInsight {
  id: string;
  category: string;
  content: string;
  
  // 新增：来源追溯
  supporting_source_ids: string[];
  
  // 新增：引用属性
  citability: 'direct' | 'paraphrase' | 'background';
  evidence_strength: 'strong' | 'medium' | 'weak';
  
  // 新增：风险标记
  risk_flag: boolean;
  confidence_score: number;  // 0-1
  
  user_decision?: 'confirmed' | 'ignored' | 'pending';
}

// Research Pack（统一输出）
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
    
    // 验证每个 source 必需字段
    for (const source of data.sources) {
      if (!source.id || !source.title || !source.content) return false;
      if (typeof source.credibility_score !== 'number') return false;
      if (typeof source.recency_score !== 'number') return false;
      if (typeof source.relevance_score !== 'number') return false;
      if (typeof source.token_length !== 'number') return false;
    }
    
    // 验证每个 insight 必需字段
    for (const insight of data.insights) {
      if (!insight.id || !insight.category || !insight.content) return false;
      if (!Array.isArray(insight.supporting_source_ids)) return false;
      if (!insight.citability || !insight.evidence_strength) return false;
      if (typeof insight.confidence_score !== 'number') return false;
    }
    
    return true;
  }
};
