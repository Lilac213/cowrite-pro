export interface ArgumentBlock {
  block_id: string;
  title: string;
  main_argument: string;
  derived_from: string[];
  citation_ids: string[];
  supporting_points: string[];
  estimated_word_count: number;
  order: number;
}

export interface ArgumentOutline {
  core_thesis: string;
  argument_blocks: ArgumentBlock[];
  coverage_check: {
    covered_insights: string[];
    unused_insights: string[];
    coverage_percentage: number;
  };
  logical_pattern: '因果' | '递进' | '总分' | '并列' | '对比';
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

    for (const block of data.argument_blocks) {
      if (!block.block_id || !block.title || !block.main_argument) {
        return false;
      }

      if (!Array.isArray(block.derived_from) || block.derived_from.length === 0) {
        return false;
      }

      if (!Array.isArray(block.citation_ids)) {
        return false;
      }
    }

    if (!data.coverage_check || !Array.isArray(data.coverage_check.covered_insights)) {
      return false;
    }

    return true;
  }
};
