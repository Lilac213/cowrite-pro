import { runLLMAgent } from '../runtime/LLMRuntime.js';

const adjustmentSchema = {
  required: ['core_thesis', 'argument_blocks'],
  validate: (data: any) => {
    return !!data.core_thesis && Array.isArray(data.argument_blocks);
  }
};

export interface StructureAdjustmentInput {
  core_thesis: string;
  argument_blocks: any[];
  operation: 'add' | 'delete' | 'modify' | 'check';
  block_index?: number;
}

export async function runStructureAdjustmentAgent(input: StructureAdjustmentInput) {
  const { core_thesis, argument_blocks, operation, block_index } = input;

  let currentStructure = `核心论点：${core_thesis}\n\n当前论证块：\n`;
  argument_blocks.forEach((block: any, index: number) => {
    currentStructure += `Block ID: ${block.id || 'new'}\n序号: ${index + 1}\n标题: ${block.title}\n作用: ${block.description || block.main_argument}\n---\n`;
  });

  let taskDescription = '';
  if (operation === 'add') {
    taskDescription = `用户在位置 ${block_index! + 1} 添加了一个新的论证块。请为这个新论证块生成合适的标题和作用说明，并确保与前后论证块的逻辑关系流畅。同时检查最后一个论证块是否为总结性质（复述总论点/总结升华/展望未来），如果不是，请调整最后一个论证块使其成为合适的结尾。`;
  } else if (operation === 'delete') {
    taskDescription = `用户删除了位置 ${block_index! + 1} 的论证块。请调整剩余论证块的关系说明，确保整体论证流畅。同时确保最后一个论证块为总结性质（复述总论点/总结升华/展望未来）。`;
  } else if (operation === 'modify') {
    taskDescription = `用户修改了位置 ${block_index! + 1} 的论证块。请检查并调整相邻论证块的关系说明，确保整体论证连贯。同时确保最后一个论证块为总结性质（复述总论点/总结升华/展望未来）。`;
  } else {
    taskDescription = `请检查整体论证结构的连贯性，确保论证块之间的关系清晰，并确保最后一个论证块为总结性质（复述总论点/总结升华/展望未来）。`;
  }

  const prompt = `你是写作系统中的「文章级论证架构调整模块」。

【当前结构】
${currentStructure}

【调整任务】
${taskDescription}

【要求】
1. 保持核心论点不变
2. 确保论证块之间的逻辑关系清晰（并列/递进/因果/对比）
3. 最后一个论证块必须是总结性质：复述总论点、总结升华或展望未来
4. 整体结构应该完整：引入→展开→总结
5. 不生成具体段落内容，但请保留或生成每个块的 "main_argument" (主要论点/作用)
6. 输出应稳定、抽象、可编辑
7. **重要**: 如果是保留原有的 Block，请务必返回原有的 "id" (Block ID)。如果是新增的 Block，请使用 "new_block" 作为 id 或留空。

【输出格式】
{
  "core_thesis": "核心论点",
  "argument_blocks": [
    {
      "id": "block_id_from_input_or_new",
      "title": "标题",
      "main_argument": "论证作用/主要论点",
      "order": 1,
      "relation": "并列/递进/因果/对比/总结"
    }
  ]
}

请严格按照要求的JSON格式返回调整后的完整结构。`;

  return await runLLMAgent({
    prompt,
    schema: adjustmentSchema,
    agentName: 'structureAdjustmentAgent'
  });
}
