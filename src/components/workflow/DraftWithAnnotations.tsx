import { useState, useEffect, useRef, type ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import type { ParagraphAnnotation, Citation } from '@/types';
import { FileText, BookOpen, Edit3, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/db/supabase';
import CitationMarker from '../draft/CitationMarker';
import DraftGuidance from '../draft/DraftGuidance';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from '@/contexts/AuthContext';
import { createMaterial } from '@/api/material.api';
import { toast } from 'sonner';

interface DraftWithAnnotationsProps {
  content: string;
  annotations: ParagraphAnnotation[];
  onContentChange?: (content: string) => void;
  readonly?: boolean;
  projectId?: string;
}

const paragraphTypeColors: Record<string, string> = {
  '引言': 'bg-blue-100 text-blue-800',
  '文献综述': 'bg-purple-100 text-purple-800',
  '观点提出': 'bg-green-100 text-green-800',
  '对比分析': 'bg-yellow-100 text-yellow-800',
  '方法说明': 'bg-orange-100 text-orange-800',
  '结论': 'bg-red-100 text-red-800',
  '其他': 'bg-gray-100 text-gray-800',
};

export default function DraftWithAnnotations({
  content,
  annotations,
  onContentChange,
  readonly = false,
  projectId,
}: DraftWithAnnotationsProps) {
  const { user } = useAuth();
  const [activeParagraphId, setActiveParagraphId] = useState<string | null>(null);
  const [editingParagraphId, setEditingParagraphId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [materials, setMaterials] = useState<Record<string, Citation>>({});
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null);
  
  // Material Save Dialog State
  const [showSaveMaterialDialog, setShowSaveMaterialDialog] = useState(false);
  const [pendingMaterialContent, setPendingMaterialContent] = useState('');

  // Parse paragraphs
  // Note: We use a more robust split that preserves empty lines if needed, but for now standard split is fine
  const paragraphs = (content || '').split(/\n\n+/).filter(p => p.trim());

  useEffect(() => {
    if (paragraphs.length === 0) return;
    if (!activeParagraphId) {
      setActiveParagraphId('P1');
      return;
    }
    const index = parseInt(activeParagraphId.replace('P', '')) - 1;
    if (index < 0 || index >= paragraphs.length) {
      setActiveParagraphId('P1');
    }
  }, [activeParagraphId, paragraphs.length]);

  // Fetch materials for citations
  useEffect(() => {
    if (!projectId) return;

    const fetchMaterials = async () => {
      try {
        // Fetch research insights as they are the source of "资料X" usually
        const { data: insights } = await supabase
          .from('research_insights')
          .select('*')
          .eq('project_id', projectId);

        if (insights) {
          const matMap: Record<string, Citation> = {};
          insights.forEach((insight: any, index: number) => {
            const titleSource = insight?.supporting_data?.title || insight?.supporting_data?.source_title;
            const titleFallback = insight?.insight ? `${insight.insight.slice(0, 50)}${insight.insight.length > 50 ? '...' : ''}` : '未命名资料';
            const summary = insight?.supporting_data?.summary || insight?.supporting_data?.abstract || insight?.supporting_data?.content_summary;
            const materialUrl = insight?.supporting_data?.url || insight?.supporting_data?.source_url || insight?.supporting_data?.link;
            const quote = insight?.supporting_data?.quote || insight?.supporting_data?.excerpt || insight?.supporting_data?.text;

            // Map index+1 (e.g. "1") to citation data
            // We assume text uses (见资料1), (见资料2) etc.
            matMap[(index + 1).toString()] = {
              id: insight.id,
              material_id: insight.id, // Add material_id to match Citation type if needed, or update Citation type
              material_title: titleSource || titleFallback,
              material_source: insight.source_type || insight.category || '研究洞察',
              material_summary: summary,
              insight: insight.insight,
              quote,
              material_url: materialUrl,
              position: 0 // Not used in this context
            };
          });
          setMaterials(matMap);
        }
      } catch (error) {
        console.error('Failed to fetch materials:', error);
      }
    };

    fetchMaterials();
  }, [projectId]);

  const handleParagraphClick = (paragraphId: string, text: string) => {
    if (activeParagraphId === paragraphId) return;
    
    setActiveParagraphId(paragraphId);
    
    // Scroll to annotation
    const annotationElement = document.getElementById(`annotation-${paragraphId}`);
    if (annotationElement) {
      annotationElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  const handleEditStart = (paragraphId: string, text: string) => {
    if (readonly) return;
    setEditingParagraphId(paragraphId);
    setEditValue(text);
    setActiveParagraphId(paragraphId);
  };

  const handleEditCancel = () => {
    setEditingParagraphId(null);
    setEditValue('');
  };

  const handleEditSave = (paragraphId: string) => {
    if (!onContentChange) return;

    const index = parseInt(paragraphId.replace('P', '')) - 1;
    const newParagraphs = [...paragraphs];
    if (index >= 0 && index < newParagraphs.length) {
      // Check if content actually changed
      if (newParagraphs[index] !== editValue) {
        newParagraphs[index] = editValue;
        onContentChange(newParagraphs.join('\n\n'));
        
        // Trigger Material Save Dialog
        setPendingMaterialContent(editValue);
        setShowSaveMaterialDialog(true);
      }
    }
    
    setEditingParagraphId(null);
    setEditValue('');
  };
  
  const handleConfirmSaveMaterial = async () => {
    if (!user || !pendingMaterialContent) return;
    
    try {
      await createMaterial({
        user_id: user.id,
        project_id: projectId, // Optional association
        title: `文章片段 - ${new Date().toLocaleDateString()}`,
        content: pendingMaterialContent,
        material_type: 'experience', // Default type, user can edit later
        keywords: ['draft-snippet']
      });
      toast.success('已保存到个人素材库');
    } catch (error) {
      console.error('Failed to save material:', error);
      toast.error('保存素材失败');
    } finally {
      setShowSaveMaterialDialog(false);
      setPendingMaterialContent('');
    }
  };

  const handleAnnotationClick = (paragraphId: string) => {
    setActiveParagraphId(paragraphId);
    const paragraphElement = document.getElementById(`paragraph-${paragraphId}`);
    if (paragraphElement) {
      paragraphElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  // Helper to update paragraph from Chat/Suggestions
  const updateParagraphFromGuidance = (paragraphId: string, newContent: string) => {
    if (!onContentChange) return;
    
    const index = parseInt(paragraphId.replace('P', '')) - 1;
    const newParagraphs = [...paragraphs];
    if (index >= 0 && index < newParagraphs.length) {
      if (newParagraphs[index] !== newContent) {
        newParagraphs[index] = newContent;
        onContentChange(newParagraphs.join('\n\n'));
        
        // Trigger Material Save Dialog
        setPendingMaterialContent(newContent);
        setShowSaveMaterialDialog(true);
      }
    }
  };

  const handleCitationSelect = (citation: Citation) => {
    setSelectedCitation(citation);
  };

  // Render paragraph content with interactive citations
  const renderParagraphContent = (text: string) => {
    // Regex to match (见资料X) or [资料X] or (资料X)
    // Captures the number
    const regex = /[(（\[]见?资料(\d+)[)）\]]/g;
    const parts: ReactNode[] = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      // Text before match
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }
      
      const materialIndex = match[1];
      const material = materials[materialIndex];
      
      if (material) {
          parts.push(
            <CitationMarker 
              key={`${match.index}`} 
              citation={material} 
              index={parseInt(materialIndex)} 
              onSelect={handleCitationSelect}
            />
          );
      } else {
        parts.push(match[0]); // Keep original if no material found
      }
      
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts.length > 0 ? parts : text;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-200px)]">
      {/* 左侧：正文 (Occupies 7/12 columns, making it wider) */}
      <Card className="flex flex-col border-r-0 rounded-r-none lg:col-span-7">
        <CardHeader className="bg-slate-50 border-b">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5 text-primary" />
            文章正文
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden p-0 bg-white">
          <ScrollArea className="h-full px-6 py-6">
            <div className="space-y-6 pb-20">
              {paragraphs.map((paragraph, index) => {
                const paragraphId = `P${index + 1}`;
                const isActive = activeParagraphId === paragraphId;
                const isEditing = editingParagraphId === paragraphId;
                const annotation = annotations.find(a => a.paragraph_id === paragraphId);
                
                // Clean paragraph marker if present in text (e.g. [P1])
                const cleanText = paragraph.replace(/^\[P\d+\]\s*/, '');

                if (isEditing) {
                  return (
                    <div key={paragraphId} className="space-y-2 animate-in fade-in zoom-in-95 duration-200">
                      <div className="flex items-center justify-between mb-1">
                        <Badge variant="outline">正在编辑: {paragraphId}</Badge>
                        <div className="flex gap-1">
                           <Button size="sm" variant="ghost" onClick={handleEditCancel} className="h-7 w-7 p-0 rounded-full hover:bg-red-100 hover:text-red-600">
                             <X className="h-4 w-4" />
                           </Button>
                           <Button size="sm" variant="ghost" onClick={() => handleEditSave(paragraphId)} className="h-7 w-7 p-0 rounded-full hover:bg-green-100 hover:text-green-600">
                             <Check className="h-4 w-4" />
                           </Button>
                        </div>
                      </div>
                      <Textarea
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="min-h-[150px] font-serif text-base leading-relaxed resize-none shadow-inner bg-slate-50"
                        autoFocus
                        onKeyDown={(e) => {
                          // Ctrl+Enter or Cmd+Enter to save
                          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                            handleEditSave(paragraphId);
                          }
                        }}
                      />
                      <div className="text-xs text-muted-foreground text-right">
                        按 Ctrl+Enter 保存, Esc 取消
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={paragraphId}
                    id={`paragraph-${paragraphId}`}
                    className={`group relative p-6 rounded-xl transition-all duration-300 border-2 ${
                      isActive
                        ? 'border-primary/30 bg-primary/5 shadow-md'
                        : 'border-transparent hover:border-slate-200 hover:bg-slate-50'
                    }`}
                    onClick={() => handleParagraphClick(paragraphId, cleanText)}
                    onDoubleClick={() => handleEditStart(paragraphId, cleanText)}
                  >
                    {/* Paragraph Header */}
                    <div className="flex items-center gap-3 mb-3 opacity-60 group-hover:opacity-100 transition-opacity">
                      <Badge variant="secondary" className="font-mono text-xs bg-slate-200 text-slate-700">
                        {paragraphId}
                      </Badge>
                      {annotation && (
                        <Badge className={`${paragraphTypeColors[annotation.paragraph_type]} border-0 font-normal`}>
                          {annotation.paragraph_type}
                        </Badge>
                      )}
                      
                      {/* Quick Edit Button */}
                      {!readonly && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6 ml-auto opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditStart(paragraphId, cleanText);
                          }}
                        >
                          <Edit3 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                    
                    {/* Content */}
                    <p className="text-base text-slate-800 leading-relaxed font-serif text-justify whitespace-pre-wrap">
                      {renderParagraphContent(cleanText)}
                    </p>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* 右侧：协作教练 (Occupies 5/12 columns) */}
      <Card className="flex flex-col bg-slate-50/50 border-l-0 rounded-l-none shadow-none lg:col-span-5">
        <CardHeader className="bg-slate-50/80 backdrop-blur border-b sticky top-0 z-10">
          <CardTitle className="flex items-center gap-2 text-lg">
            <BookOpen className="h-5 w-5 text-primary" />
            协作教练
            <Badge variant="outline" className="ml-2 font-normal text-xs uppercase tracking-wider">Coaching Rail</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden p-0">
          <div className="flex flex-col h-full">
            <div className="border-b bg-white">
              <div className="p-4 space-y-3">
                <div className="text-sm font-medium text-slate-700">资料详情</div>
                {selectedCitation ? (
                  <div className="space-y-3">
                    <div>
                      <div className="text-xs text-muted-foreground">标题</div>
                      <div className="text-sm text-slate-800">{selectedCitation.material_title}</div>
                    </div>
                    {selectedCitation.material_source && (
                      <div>
                        <div className="text-xs text-muted-foreground">来源</div>
                        <div className="text-sm text-slate-800">{selectedCitation.material_source}</div>
                      </div>
                    )}
                    {selectedCitation.insight && (
                      <div>
                        <div className="text-xs text-muted-foreground">观点洞察</div>
                        <div className="text-sm text-slate-800">{selectedCitation.insight}</div>
                      </div>
                    )}
                    {selectedCitation.material_summary && (
                      <div>
                        <div className="text-xs text-muted-foreground">摘要</div>
                        <div className="text-sm text-slate-800">{selectedCitation.material_summary}</div>
                      </div>
                    )}
                    {selectedCitation.quote && (
                      <div>
                        <div className="text-xs text-muted-foreground">引用内容</div>
                        <div className="text-sm text-slate-700 italic">{selectedCitation.quote}</div>
                      </div>
                    )}
                    {selectedCitation.material_url && (
                      <a
                        href={selectedCitation.material_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-xs text-primary hover:underline"
                      >
                        查看原文
                      </a>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">点击正文中的资料编号查看详情</div>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              <DraftGuidance 
                guidance={annotations} 
                activeParagraphId={activeParagraphId || undefined}
                paragraphContent={activeParagraphId ? paragraphs[parseInt(activeParagraphId.replace('P', '')) - 1] : undefined}
                onUpdateParagraph={updateParagraphFromGuidance}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Material Save Dialog */}
      <AlertDialog open={showSaveMaterialDialog} onOpenChange={setShowSaveMaterialDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>保存到个人素材库？</AlertDialogTitle>
            <AlertDialogDescription>
              您刚刚修改了段落内容。是否将此更新后的内容作为一个新的“经验”或“观点”素材保存到您的个人素材库中，以便将来复用？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowSaveMaterialDialog(false)}>不保存</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmSaveMaterial}>保存素材</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
