/**
 * Structure Agent Schema
 * 文章结构层 Payload 格式定义
 */

export interface ArgumentBlock {
  block_id: string;
  title: string;
  main_argument: string;
  
  // 新增：强制引用来源
  derived_from: string[];  // insight IDs，不允许为空
  citation_ids: string[];  // source IDs
  
  supporting_points: string[];
  estimated_word_count: number;
  order: number;
}

export interface ArgumentOutline {
  core_thesis: string;
  argument_blocks: ArgumentBlock[];
  
  // 新增：完整性检查
  coverage_check: {
    covered_insights: string[];
    unused_insights: string[];
    coverage_percentage: number;
  };
  
  // 新增：逻辑模式
  logical_pattern: '因果' | '递进' | '总分' | '并列' | '对比';
  
  // 新增：字数分配
  estimated_word_distribution: {
    [block_id: string]: number;
  };
  
  total_estimated_words: number;
}

export const structureSchema = {
  required: [
    'core_thesis',
    'argument_blocks',
    'coverage_check',
    'logical_pattern',
    'estimated_word_distribution'
  ],
  validate: (data: any) => {
    if (!data.core_thesis || !Array.isArray(data.argument_blocks)) {
      return false;
    }
    
    // 验证每个 block 必需字段
    for (const block of data.argument_blocks) {
      if (!block.block_id || !block.title || !block.main_argument) {
        return false;
      }
      
      // 强制要求：derived_from 不能为空
      if (!Array.isArray(block.derived_from) || block.derived_from.length === 0) {
        console.error(`Block ${block.block_id} has empty derived_from`);
        return false;
      }
      
      // 强制要求：citation_ids 必须存在
      if (!Array.isArray(block.citation_ids)) {
        return false;
      }
    }
    
    // 验证 coverage_check
    if (!data.coverage_check || !Array.isArray(data.coverage_check.covered_insights)) {
      return false;
    }
    
    return true;
  }
};
