export type UserRole = 'user' | 'admin';

export type ProjectStatus =
  | 'init'
  | 'confirm_brief'
  | 'knowledge_selected'
  | 'outline_confirmed'
  | 'drafting'
  | 'review_pass_1'
  | 'review_pass_2'
  | 'review_pass_3'
  | 'completed';

export type MaterialType = 'experience' | 'opinion' | 'case';
export type MaterialSource = 'manual' | 'ai_generated' | 'imported';
export type MaterialStatus = 'unused' | 'used' | 'in_project';

export interface Profile {
  id: string;
  username: string;
  role: UserRole;
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

export interface Project {
  id: string;
  user_id: string;
  title: string;
  status: ProjectStatus;
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
  created_at: string;
}

export interface Outline {
  id: string;
  project_id: string;
  paragraph_order: number;
  summary: string;
  selected: boolean;
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
