-- 添加 material_review 状态到 project_status 枚举
ALTER TYPE project_status ADD VALUE IF NOT EXISTS 'material_review' AFTER 'knowledge_selected';