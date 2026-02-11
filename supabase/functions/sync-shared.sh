#!/bin/bash
# Supabase Edge Functions 部署前同步脚本
# 
# 说明：
# Supabase Edge Functions 的部署系统不支持 _shared 目录的自动打包
# 因此需要在部署前将 _shared/llm 目录同步到每个使用它的函数中
# 
# _shared/llm 是唯一的源代码真实来源（Single Source of Truth）
# 各函数目录中的 llm 副本仅用于部署，不应手动修改

FUNCTIONS_DIR="/workspace/app-9bwpferlujnl/supabase/functions"
SHARED_LLM="$FUNCTIONS_DIR/_shared/llm"

# 需要同步的函数列表
AGENT_FUNCTIONS=(
  "brief-agent"
  "research-retrieval"
  "research-synthesis"
  "structure-agent"
  "draft-agent"
  "review-agent"
  "adjust-article-structure"
  "generate-article-structure"
  "verify-coherence"
)

echo "🔄 开始同步 _shared/llm 到各 Edge Functions..."

for func in "${AGENT_FUNCTIONS[@]}"; do
  FUNC_DIR="$FUNCTIONS_DIR/$func"
  
  if [ ! -d "$FUNC_DIR" ]; then
    echo "⚠️  跳过不存在的函数: $func"
    continue
  fi
  
  # 删除旧的副本
  rm -rf "$FUNC_DIR/llm"
  
  # 复制新的副本
  cp -r "$SHARED_LLM" "$FUNC_DIR/llm"
  
  # 更新 import 路径（从 ../_shared/llm/ 改为 ./llm/）
  if [ -f "$FUNC_DIR/index.ts" ]; then
    sed -i "s|'../_shared/llm/|'./llm/|g" "$FUNC_DIR/index.ts"
  fi
  
  echo "✅ $func"
done

echo ""
echo "✨ 同步完成！现在可以部署 Edge Functions 了"
echo ""
echo "⚠️  重要提示："
echo "   - _shared/llm 是唯一的代码源"
echo "   - 各函数中的 llm 目录是自动生成的副本"
echo "   - 修改代码请在 _shared/llm 中进行，然后重新运行此脚本"
