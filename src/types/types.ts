export type UserRole = 'user' | 'admin';

export type ProjectStatus =
  | 'init'
  | 'confirm_brief'
  | 'knowledge_selected'
  | 'outline_confirmed'
  | 'paragraph_structure_confirmed'
  | 'drafting'
  | 'review_pass_1'
  | 'review_pass_2'
  | 'review_pass_3'
  | 'layout_export'
  | 'completed';

export type MaterialType = 'experience' | 'opinion' | 'case';
export type MaterialSource = 'manual' | 'ai_generated' | 'imported';
export type MaterialStatus = 'unused' | 'used' | 'in_project';

export interface Profile {
  id: string;
  username: string;
  role: UserRole;
  available_credits: number;
  unlimited_credits: boolean;
  ai_reducer_used: number;
  projects_created: number;
  invitation_code?: string;
  created_at: string;
  updated_at: string;
}

export interface InvitationCode {
  id: string;
  code: string;
  credits: number;
  used_count: number;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type OrderStatus = 'pending' | 'completed' | 'cancelled' | 'refunded';

export interface Order {
  id: string;
  user_id: string;
  items: any[];
  total_amount: number;
  currency: string;
  status: OrderStatus;
  stripe_session_id?: string;
  stripe_payment_intent_id?: string;
  customer_email?: string;
  customer_name?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface SystemConfig {
  id: string;
  config_key: string;
  config_value: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;
}

export interface ArgumentBlock {
  id: string;
  title: string;
  description: string;
  order: number;
}

export interface ArticleArgumentStructure {
  core_thesis: string;
  argument_blocks: ArgumentBlock[];
}

export interface Project {
  id: string;
  user_id: string;
  title: string;
  status: ProjectStatus;
  article_argument_structure?: ArticleArgumentStructure;
  paragraph_structures?: any[];
  writing_summary?: any;
  created_at: string;
  updated_at: string;
}

export interface Brief {
  id: string;
  project_id: string;
  topic: string;
  format_template?: string;
  output_format?: string;
  requirements?: Record<string, any>;
  confirmed: boolean;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeBase {
  id: string;
  project_id: string;
  title: string;
  content: string;
  source: string;
  source_url?: string;
  published_at?: string;
  collected_at: string;
  next_update_suggestion?: string;
  selected: boolean;
  keywords?: string[];
  content_status?: 'full_text' | 'abstract_only' | 'insufficient_content' | 'unavailable_fulltext';
  extracted_content?: string[];
  full_text?: string;
  created_at: string;
}

export interface SubArgument {
  id: string;
  content: string;
  order: number;
}

export interface EvidenceItem {
  id: string;
  sub_argument_id: string;
  type: 'case' | 'data' | 'analogy';
  content: string;
  source?: string;
  uncertainty?: string;
  selected: boolean;
}

export interface ReasoningStructure {
  main_argument: string;
  sub_arguments: SubArgument[];
  conclusion: string;
}

export interface ParagraphStructure {
  input_assumption: string;
  core_claim: string;
  sub_claims: string[];
  output_state: string;
}

export interface SupportingMaterial {
  type: string;
  content: string;
  uncertainty?: string;
}

export interface SubClaimWithMaterials {
  sub_claim: string;
  materials: SupportingMaterial[];
  selected_materials: number[];
}

export interface Outline {
  id: string;
  project_id: string;
  paragraph_order: number;
  summary: string;
  selected: boolean;
  reasoning_structure?: ReasoningStructure;
  evidence_pool?: EvidenceItem[];
  paragraph_structure?: ParagraphStructure;
  sub_claims_materials?: SubClaimWithMaterials[];
  coherence_check?: any;
  final_text?: string;
  created_at: string;
  updated_at: string;
}

export interface ReferenceArticle {
  id: string;
  user_id: string;
  project_id?: string;
  title: string;
  content: string;
  source_type?: string;
  source_url?: string;
  tags?: string[];
  ai_analysis?: {
    core_points?: string[];
    structure?: any;
    borrowable_segments?: any[];
    recommended_projects?: string[];
  };
  keywords?: string[];
  summary?: string;
  file_url?: string;
  file_type?: string;
  created_at: string;
  updated_at?: string;
}

export interface Material {
  id: string;
  user_id: string;
  project_id?: string;
  title: string;
  material_type: MaterialType;
  content: string;
  source?: MaterialSource;
  tags?: string[];
  status?: MaterialStatus;
  project_ids?: string[];
  keywords?: string[];
  summary?: string;
  file_url?: string;
  file_type?: string;
  created_at: string;
  updated_at?: string;
}

export interface Draft {
  id: string;
  project_id: string;
  content: string;
  version: number;
  annotations?: ParagraphAnnotation[];
  created_at: string;
  updated_at: string;
}

export interface ParagraphAnnotation {
  paragraph_id: string;
  paragraph_type: '引言' | '文献综述' | '观点提出' | '对比分析' | '方法说明' | '结论' | '其他';
  information_source: {
    references?: string[];
    data_sources?: string[];
    is_direct_quote: boolean;
  };
  viewpoint_generation: '文献直接观点' | '多文献综合' | '基于数据的推导' | '模型逻辑推演';
  development_logic: string;
  editing_suggestions: string;
}

export interface Review {
  id: string;
  project_id: string;
  review_round: 1 | 2 | 3;
  issues?: Record<string, any>;
  completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface Template {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  content: string;
  format: string;
  rules?: {
    page_structure?: any;
    style_rules?: any;
    validation_rules?: any;
  };
  preview_content?: string;
  summary?: string;
  tags?: string[];
  created_at: string;
  updated_at?: string;
}

export interface SearchResult {
  title: string;
  content: string;
  source: string;
  url: string;
  publishedAt?: string;
}

export interface ReferenceLibrary {
  id: string;
  user_id: string;
  title: string;
  content: string;
  source?: string;
  source_url?: string;
  keywords?: string[];
  published_at?: string;
  saved_at: string;
  created_at: string;
}

// 写作会话和决策相关类型
export type WritingStage = 'research' | 'structure' | 'paragraph' | 'evidence' | 'writing' | 'completed';

export interface WritingSession {
  id: string;
  project_id: string;
  current_stage: WritingStage;
  locked_core_thesis: boolean;
  locked_structure: boolean;
  created_at: string;
  updated_at: string;
}

export type SourceType = 'academic' | 'news' | 'web' | 'user_library' | 'personal';

export interface RetrievedMaterial {
  id: string;
  session_id: string;
  source_type: SourceType;
  title: string;
  url?: string;
  abstract?: string;
  full_text?: string;
  authors?: string;
  year?: string;
  citation_count?: number;
  published_at?: string;
  is_selected: boolean;
  metadata?: any;
  created_at: string;
}

export type UserDecision = 'pending' | 'adopt' | 'downgrade' | 'reject';
export type RecommendedUsage = 'direct' | 'background' | 'optional';
export type Citability = 'direct' | 'background' | 'controversial';

export interface ResearchInsight {
  id: string;
  session_id: string;
  insight_id: string;
  category: string;
  insight: string;
  supporting_data: string[];
  source_type: string;
  recommended_usage: RecommendedUsage;
  citability: Citability;
  limitations: string;
  user_decision: UserDecision;
  created_at: string;
}

export interface ResearchGap {
  id: string;
  session_id: string;
  gap_id: string;
  issue: string;
  description: string;
  user_decision: 'pending' | 'respond' | 'ignore';
  created_at: string;
}

export interface StructureDecision {
  id: string;
  session_id: string;
  core_thesis_confirmed: boolean;
  core_thesis_override?: string;
  removed_blocks: string[];
  reordered_blocks: string[];
  created_at: string;
  updated_at: string;
}

export interface ParagraphDecision {
  id: string;
  session_id: string;
  paragraph_id: string;
  action: 'accept' | 'revise' | 'skip';
  revise_type?: 'logic' | 'experience' | 'counter';
  created_at: string;
}

export interface EvidenceDecision {
  id: string;
  session_id: string;
  sub_claim_id: string;
  selected_evidence_ids: string[];
  created_at: string;
}

export interface SynthesisResult {
  thought: string;
  synthesis: {
    synthesized_insights: Array<{
      id: string;
      category: string;
      insight: string;
      supporting_data: string[];
      source_type: string;
      recommended_usage: RecommendedUsage;
      citability: Citability;
      limitations: string;
      user_decision: string;
    }>;
    contradictions_or_gaps: Array<{
      id: string;
      issue: string;
      description: string;
      user_decision: string;
    }>;
  };
  sessionId?: string;
}
