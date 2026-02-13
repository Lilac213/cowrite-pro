// 工作流阶段定义
export const WORKFLOW_STAGES = [
  { key: 'init', label: '开始', progress: 0 },
  { key: 'confirm_brief', label: '需求明确', progress: 12 },
  { key: 'knowledge_selected', label: '资料搜索', progress: 25 },
  { key: 'material_review', label: '资料整理', progress: 38 },
  { key: 'outline_confirmed', label: '文章结构', progress: 50 },
  { key: 'drafting', label: '生成草稿', progress: 65 },
  { key: 'review_pass_1', label: '内容审校', progress: 80 },
  { key: 'layout_export', label: '排版导出', progress: 92 },
  { key: 'completed', label: '完成', progress: 100 },
];

// 工作流阶段类型
export type WorkflowStageKey = typeof WORKFLOW_STAGES[number]['key'];