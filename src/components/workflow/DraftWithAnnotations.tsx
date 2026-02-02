import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { ParagraphAnnotation } from '@/types';
import { FileText, BookOpen, Lightbulb, Edit3 } from 'lucide-react';

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

      {/* 右侧：注释 */}
      <Card className="flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            段落注释
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden">
          <ScrollArea className="h-full pr-4">
            <div className="space-y-4">
              {annotations.map((annotation) => {
                const isActive = activeParagraphId === annotation.paragraph_id;

                return (
                  <Card
                    key={annotation.paragraph_id}
                    id={`annotation-${annotation.paragraph_id}`}
                    className={`cursor-pointer transition-all ${
                      isActive ? 'ring-2 ring-primary' : ''
                    }`}
                    onClick={() => handleAnnotationClick(annotation.paragraph_id)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline">{annotation.paragraph_id} 注释</Badge>
                        <Badge className={paragraphTypeColors[annotation.paragraph_type]}>
                          {annotation.paragraph_type}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      {/* 信息来源 */}
                      <div>
                        <div className="font-semibold mb-1 flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          信息来源
                        </div>
                        <div className="text-muted-foreground space-y-1">
                          {annotation.information_source.references && annotation.information_source.references.length > 0 ? (
                            <div>
                              <span className="font-medium">参考文献：</span>
                              {annotation.information_source.references.join('；')}
                            </div>
                          ) : (
                            <div>
                              <span className="font-medium">参考文献：</span>无直接引用
                            </div>
                          )}
                          {annotation.information_source.data_sources && annotation.information_source.data_sources.length > 0 && (
                            <div>
                              <span className="font-medium">数据来源：</span>
                              {annotation.information_source.data_sources.join('；')}
                            </div>
                          )}
                          <div>
                            <span className="font-medium">是否直接引用：</span>
                            {annotation.information_source.is_direct_quote ? '是' : '否（改写）'}
                          </div>
                        </div>
                      </div>

                      {/* 观点生成方式 */}
                      <div>
                        <div className="font-semibold mb-1 flex items-center gap-1">
                          <Lightbulb className="h-3 w-3" />
                          观点生成方式
                        </div>
                        <div className="text-muted-foreground">
                          {viewpointGenerationLabels[annotation.viewpoint_generation]}
                        </div>
                      </div>

                      {/* 本段展开逻辑 */}
                      <div>
                        <div className="font-semibold mb-1">本段展开逻辑</div>
                        <div className="text-muted-foreground">
                          {annotation.development_logic}
                        </div>
                      </div>

                      {/* 可编辑建议 */}
                      <div className="bg-muted/50 p-3 rounded-md">
                        <div className="font-semibold mb-1 flex items-center gap-1 text-primary">
                          <Edit3 className="h-3 w-3" />
                          可编辑建议
                        </div>
                        <div className="text-muted-foreground">
                          {annotation.editing_suggestions}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
