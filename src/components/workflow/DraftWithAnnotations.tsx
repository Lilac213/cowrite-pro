import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { ParagraphAnnotation } from '@/types';
import { FileText, BookOpen, Lightbulb, Edit3, Sparkles } from 'lucide-react';

interface DraftWithAnnotationsProps {
  content: string;
  annotations: ParagraphAnnotation[];
  onContentChange?: (content: string) => void;
  readonly?: boolean;
}

const paragraphTypeColors = {
  '引言': 'bg-blue-100 text-blue-800',
  '文献综述': 'bg-purple-100 text-purple-800',
  '观点提出': 'bg-green-100 text-green-800',
  '对比分析': 'bg-yellow-100 text-yellow-800',
  '方法说明': 'bg-orange-100 text-orange-800',
  '结论': 'bg-red-100 text-red-800',
  '其他': 'bg-gray-100 text-gray-800',
};

const viewpointGenerationLabels = {
  '文献直接观点': '📚 文献直接观点',
  '多文献综合': '🔗 多文献综合',
  '基于数据的推导': '📊 基于数据的推导',
  '模型逻辑推演': '🤖 模型逻辑推演',
};

export default function DraftWithAnnotations({
  content,
  annotations,
  onContentChange,
  readonly = false,
}: DraftWithAnnotationsProps) {
  const [activeParagraphId, setActiveParagraphId] = useState<string | null>(null);
  const [editableContent, setEditableContent] = useState(content);

  useEffect(() => {
    setEditableContent(content);
  }, [content]);

  // 解析段落
  const paragraphs = content.split(/\n\n+/).filter(p => p.trim());

  const handleParagraphClick = (paragraphId: string) => {
    setActiveParagraphId(paragraphId);
    // 滚动到对应注释
    const annotationElement = document.getElementById(`annotation-${paragraphId}`);
    if (annotationElement) {
      annotationElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  const handleAnnotationClick = (paragraphId: string) => {
    setActiveParagraphId(paragraphId);
    // 滚动到对应段落
    const paragraphElement = document.getElementById(`paragraph-${paragraphId}`);
    if (paragraphElement) {
      paragraphElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  const getAnnotationForParagraph = (paragraphId: string) => {
    return annotations.find(a => a.paragraph_id === paragraphId);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-200px)]">
      {/* 左侧：正文 */}
      <Card className="flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            文章正文
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden">
          <ScrollArea className="h-full pr-4">
            <div className="space-y-4">
              {paragraphs.map((paragraph, index) => {
                const paragraphId = `P${index + 1}`;
                const isActive = activeParagraphId === paragraphId;
                const annotation = getAnnotationForParagraph(paragraphId);

                return (
                  <div
                    key={paragraphId}
                    id={`paragraph-${paragraphId}`}
                    className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${
                      isActive
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                    onClick={() => handleParagraphClick(paragraphId)}
                  >
                    <div className="flex items-start gap-2 mb-2">
                      <Badge variant="outline" className="shrink-0">
                        {paragraphId}
                      </Badge>
                      {annotation && (
                        <Badge className={paragraphTypeColors[annotation.paragraph_type]}>
                          {annotation.paragraph_type}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {paragraph.replace(/^\[P\d+\]\s*/, '')}
                    </p>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* 右侧：协作教练 */}
      <Card className="flex flex-col bg-slate-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            协作教练 (COACHING RAIL)
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden">
          <ScrollArea className="h-full pr-4">
            <div className="space-y-4">
              {annotations.map((annotation) => {
                const isActive = activeParagraphId === annotation.paragraph_id;

                if (!isActive && activeParagraphId !== null) return null; // Only show active annotation if one is selected

                return (
                  <Card
                    key={annotation.paragraph_id}
                    id={`annotation-${annotation.paragraph_id}`}
                    className={`transition-all ${
                      isActive ? 'ring-2 ring-primary shadow-lg' : 'opacity-80 hover:opacity-100'
                    }`}
                    onClick={() => handleAnnotationClick(annotation.paragraph_id)}
                  >
                    <CardHeader className="pb-3 border-b bg-white rounded-t-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs font-mono">#{annotation.paragraph_id}</Badge>
                          <span className="font-semibold text-sm">{annotation.paragraph_type}</span>
                        </div>
                        {isActive && <Badge variant="default" className="bg-green-600">当前聚焦</Badge>}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4 p-4 text-sm bg-white rounded-b-lg">
                      
                      {/* 段落逻辑 (LOGIC) */}
                      <div className="bg-slate-50 p-3 rounded-md border border-slate-100">
                        <div className="font-bold text-slate-700 mb-2 flex items-center gap-2 text-xs uppercase tracking-wider">
                          <Lightbulb className="h-3 w-3" />
                          段落逻辑 (LOGIC)
                        </div>
                        <div className="text-slate-600 leading-relaxed">
                          {annotation.development_logic || "本段逻辑推演..."}
                        </div>
                      </div>

                      {/* 建议补充 (SUGGESTIONS) */}
                      <div className="bg-amber-50 p-3 rounded-md border border-amber-100">
                        <div className="font-bold text-amber-700 mb-2 flex items-center gap-2 text-xs uppercase tracking-wider">
                          <Edit3 className="h-3 w-3" />
                          建议补充 (SUGGESTIONS)
                        </div>
                        <div className="text-amber-800 italic leading-relaxed">
                          "{annotation.editing_suggestions || "无具体建议"}"
                        </div>
                      </div>

                      {/* 实时协作 (ACTIVE) - 模拟用户提到的功能 */}
                      <div className="bg-black text-white p-4 rounded-lg shadow-md mt-4">
                        <div className="font-bold text-white mb-2 flex items-center justify-between text-xs uppercase tracking-wider">
                          <div className="flex items-center gap-2">
                            <Sparkles className="h-3 w-3 text-yellow-400" />
                            实时协作 (ACTIVE)
                          </div>
                          <Sparkles className="h-3 w-3 text-yellow-400" />
                        </div>
                        <div className="space-y-3">
                           <p className="text-gray-300 text-xs">
                             激发协作：插入个人视角
                           </p>
                           <p className="text-gray-400 text-xs italic">
                             系统检测到您在 Step 2 笔记中提到过“某大型国有银行的迁移阵痛”。
                           </p>
                           <button className="w-full bg-white text-black py-2 px-3 rounded text-xs font-bold hover:bg-gray-100 transition-colors flex items-center justify-center gap-2">
                             <div className="w-4 h-4 rounded-full bg-black text-white flex items-center justify-center text-[10px]">+</div>
                             插入我的创业亲身经历
                           </button>
                        </div>
                      </div>

                      {/* 信息来源 (collapsed by default or smaller) */}
                      <div className="pt-2 border-t mt-2">
                        <div className="font-semibold mb-1 flex items-center gap-1 text-xs text-muted-foreground">
                          <FileText className="h-3 w-3" />
                          参考来源
                        </div>
                        <div className="text-xs text-muted-foreground space-y-1 pl-4 border-l-2 border-muted">
                          {annotation.information_source.references && annotation.information_source.references.length > 0 ? (
                            annotation.information_source.references.map((ref, i) => (
                              <div key={i} className="truncate">• {ref}</div>
                            ))
                          ) : (
                            <div>无直接引用</div>
                          )}
                        </div>
                      </div>

                    </CardContent>
                  </Card>
                );
              })}
              {annotations.length === 0 && (
                <div className="text-center text-muted-foreground py-10">
                  暂无教练建议，请生成草稿
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
