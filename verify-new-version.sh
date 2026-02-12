#!/bin/bash

# 验证新版草稿生成页面代码

echo "🔍 验证新版草稿生成页面..."
echo ""

# 1. 检查文件存在
if [ -f "src/pages/DraftGenerationPage.tsx" ]; then
    echo "✅ 文件存在: src/pages/DraftGenerationPage.tsx"
else
    echo "❌ 文件不存在"
    exit 1
fi

# 2. 检查行数
LINES=$(wc -l < src/pages/DraftGenerationPage.tsx)
echo "✅ 文件行数: $LINES (应该约 940 行)"

# 3. 检查关键组件
echo ""
echo "🔍 检查关键组件..."

if grep -q "interface Paragraph" src/pages/DraftGenerationPage.tsx; then
    echo "✅ Paragraph 接口存在"
else
    echo "❌ Paragraph 接口缺失"
fi

if grep -q "interface ParagraphSuggestion" src/pages/DraftGenerationPage.tsx; then
    echo "✅ ParagraphSuggestion 接口存在"
else
    echo "❌ ParagraphSuggestion 接口缺失"
fi

if grep -q "function EditableParagraph" src/pages/DraftGenerationPage.tsx; then
    echo "✅ EditableParagraph 组件存在"
else
    echo "❌ EditableParagraph 组件缺失"
fi

if grep -q "function SuggestionCard" src/pages/DraftGenerationPage.tsx; then
    echo "✅ SuggestionCard 组件存在"
else
    echo "❌ SuggestionCard 组件缺失"
fi

# 4. 检查关键功能
echo ""
echo "🔍 检查关键功能..."

if grep -q "handleParagraphBlur" src/pages/DraftGenerationPage.tsx; then
    echo "✅ 段落编辑处理函数存在"
else
    echo "❌ 段落编辑处理函数缺失"
fi

if grep -q "handleAddParagraph" src/pages/DraftGenerationPage.tsx; then
    echo "✅ 添加段落函数存在"
else
    echo "❌ 添加段落函数缺失"
fi

if grep -q "handleDeleteParagraph" src/pages/DraftGenerationPage.tsx; then
    echo "✅ 删除段落函数存在"
else
    echo "❌ 删除段落函数缺失"
fi

if grep -q "getMockSuggestions" src/pages/DraftGenerationPage.tsx; then
    echo "✅ 模拟建议函数存在"
else
    echo "❌ 模拟建议函数缺失"
fi

# 5. 检查版本标识
echo ""
echo "🔍 检查版本标识..."

if grep -q "v2.0" src/pages/DraftGenerationPage.tsx; then
    echo "✅ v2.0 版本标识存在"
else
    echo "❌ v2.0 版本标识缺失"
fi

if grep -q "DraftGenerationPage v2.0" src/pages/DraftGenerationPage.tsx; then
    echo "✅ 控制台日志标识存在"
else
    echo "❌ 控制台日志标识缺失"
fi

# 6. 检查 UI 文本
echo ""
echo "🔍 检查 UI 文本..."

if grep -q "协作教练 (COACHING RAIL)" src/pages/DraftGenerationPage.tsx; then
    echo "✅ 协作教练标题存在"
else
    echo "❌ 协作教练标题缺失"
fi

if grep -q "添加段落" src/pages/DraftGenerationPage.tsx; then
    echo "✅ 添加段落按钮存在"
else
    echo "❌ 添加段落按钮缺失"
fi

if grep -q "应用建议" src/pages/DraftGenerationPage.tsx; then
    echo "✅ 应用建议按钮存在"
else
    echo "❌ 应用建议按钮缺失"
fi

# 7. 检查样式文件
echo ""
echo "🔍 检查样式文件..."

if grep -q "citation-marker" src/index.css; then
    echo "✅ citation-marker 样式存在"
else
    echo "❌ citation-marker 样式缺失"
fi

if grep -q "material-symbols-outlined" src/index.css; then
    echo "✅ material-symbols-outlined 样式存在"
else
    echo "❌ material-symbols-outlined 样式缺失"
fi

# 8. 检查 HTML 文件
echo ""
echo "🔍 检查 HTML 文件..."

if grep -q "Material Symbols Outlined" index.html; then
    echo "✅ Material Symbols 字体链接存在"
else
    echo "❌ Material Symbols 字体链接缺失"
fi

# 9. 运行 lint
echo ""
echo "🔍 运行 Lint 检查..."
npm run lint 2>&1 | grep -E "(error|Checked)" | tail -1

echo ""
echo "✅ 验证完成！"
echo ""
echo "📝 如果所有检查都通过，但浏览器仍显示旧版本，请："
echo "   1. 按 Ctrl+Shift+R (Windows/Linux) 或 Cmd+Shift+R (Mac) 强制刷新"
echo "   2. 清除浏览器缓存后刷新"
echo "   3. 使用无痕模式访问"
echo ""
echo "🎯 新版本特征："
echo "   - 标题栏显示 v2.0 标签"
echo "   - 控制台显示 '🎨 DraftGenerationPage v2.0' 日志"
echo "   - 多个独立的可编辑段落框"
echo "   - 右侧协作教练面板"
echo "   - 点击段落有蓝色边框高亮"
