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
  llm_api_key?: string;
  llm_provider?: string;
  search_api_key?: string;
  search_provider?: string;
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
  created_at: string;
  updated_at?: string;
}

export interface Draft {
  id: string;
  project_id: string;
  content: string;
  version: number;
  created_at: string;
  updated_at: string;
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
