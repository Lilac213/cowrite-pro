import { useState, useEffect, ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { 
  FileText, 
  Wand2, 
  Check, 
  X, 
  BookOpen, 
  ExternalLink,
  Edit3,
  AlignLeft,
  LayoutTemplate
} from 'lucide-react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from 'sonner';
import { supabase } from '@/db/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { createMaterial } from '@/api/material.api';
import type { Citation, ParagraphAnnotation, ParagraphGuidance } from '@/types';
import DraftGuidance from '@/components/draft/DraftGuidance';
import CitationMarker from '@/components/draft/CitationMarker';

interface DraftWithAnnotationsProps {
  content: string;
  annotations: ParagraphAnnotation[];
  guidance?: ParagraphGuidance[];
  projectId: string;
  onContentChange?: (newContent: string) => void;
  readonly?: boolean;
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
  guidance = [],
  projectId,
  onContentChange,
  readonly = false
}: DraftWithAnnotationsProps) {
  const { user } = useAuth();
  const [activeParagraphId, setActiveParagraphId] = useState<string | null>(null);
  const [editingParagraphId, setEditingParagraphId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [materials, setMaterials] = useState<Record<string, Citation>>({});
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null);
  
  // State for Material Save Dialog
  const [showSaveMaterialDialog, setShowSaveMaterialDialog] = useState(false);
  const [pendingMaterialContent, setPendingMaterialContent] = useState('');
  const [viewMode, setViewMode] = useState<'rich' | 'plain'>('rich');

  // Parse paragraphs
  // Note: We use a more robust split that preserves empty lines if needed, but for now standard split is fine
  const paragraphs = (content || '').split(/\n\n+/).filter(p => p.trim());

  useEffect(() => {
    if (paragraphs.length === 0) return;
    if (!activeParagraphId) {
      setActiveParagraphId('P1');
      return;
    }
    // Check if active paragraph still exists (e.g. after content update)
    // If not, reset to P1 or keep current if it's within bounds?
    // Here we just ensure P1 if completely out of bounds or empty
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

  const handleParagraphClick = (paragraphId: string) => {
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
        
        // Trigger Material Save Dialog - REMOVED per user request (only for Real-time Collab)
        // setPendingMaterialContent(editValue);
        // setShowSaveMaterialDialog(true);
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

  // Helper to update paragraph from Chat/Suggestions
  const updateParagraphFromGuidance = (paragraphId: string, newContent: string) => {
    if (!onContentChange) return;
    
    const index = parseInt(paragraphId.replace('P', '')) - 1;
    const newParagraphs = [...paragraphs];
    if (index >= 0 && index < newParagraphs.length) {
      if (newParagraphs[index] !== newContent) {
        newParagraphs[index] = newContent;
        onContentChange(newParagraphs.join('\n\n'));
        
        // Material Save Dialog is now handled explicitly by DraftGuidance via callback
      }
    }
  };

  const handleSaveToLibrary = (content: string) => {
    setPendingMaterialContent(content);
    setShowSaveMaterialDialog(true);
  };

  const handleCitationSelect = (citation: Citation) => {
    setSelectedCitation(citation);
  };

  // Render paragraph content with interactive citations
  const renderParagraphContent = (text: string) => {
    // Regex to match (见资料X)、(见洞察Y)、(见资料A，资料B) etc.
    // Matches the whole parenthesis group and captures the content inside
    const regex = /[(（\[]\s*见?((?:资料|洞察)\s*\d+(?:[，,]\s*(?:资料|洞察)?\s*\d+)*)\s*[)）\]]/g;
    
    const parts: ReactNode[] = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      // Text before match
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }
      
      const content = match[1];
      // Extract all numbers from the content string
      // e.g. "资料1，资料2" -> ["1", "2"]
      // e.g. "洞察3" -> ["3"]
      const idRegex = /\d+/g;
      let idMatch;
      const ids: string[] = [];
      while ((idMatch = idRegex.exec(content)) !== null) {
        ids.push(idMatch[0]);
      }
      
      if (ids.length > 0) {
          // Render a CitationMarker for each ID found
          // We wrap them in a span to keep them together if needed, or just push them
          const markers = ids.map((id) => {
            const material = materials[id];
            if (material) {
              return (
                <CitationMarker 
                  key={`${match!.index}-${id}`} 
                  citation={material} 
                  index={parseInt(id)} 
                  onSelect={handleCitationSelect} // Using onSelect for side panel or undefined for Popover
                />
              );
            }
            return null;
          }).filter(Boolean);

          if (markers.length > 0) {
            parts.push(...markers);
          } else {
             parts.push(match[0]); // Keep original if no valid materials found
          }
      } else {
        parts.push(match[0]); // Keep original if no numbers found
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
      <Card className="flex flex-col border-r-0 rounded-r-none lg:col-span-7 h-full">
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'rich' | 'plain')} className="flex flex-col h-full">
          <CardHeader className="bg-slate-50 border-b py-3 px-6 shrink-0">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="h-5 w-5 text-primary" />
                文章正文
              </CardTitle>
              <TabsList className="h-8">
                <TabsTrigger value="rich" className="text-xs px-3 h-7">
                  <LayoutTemplate className="w-3.5 h-3.5 mr-1.5" />
                  图文模式
                </TabsTrigger>
                <TabsTrigger value="plain" className="text-xs px-3 h-7">
                  <AlignLeft className="w-3.5 h-3.5 mr-1.5" />
                  纯文本
                </TabsTrigger>
              </TabsList>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden p-0 bg-white relative">
            <TabsContent value="rich" className="h-full mt-0 absolute inset-0">
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
                            className="min-h-[150px] font-serif text-xl leading-relaxed resize-none shadow-inner bg-slate-50"
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
                        onClick={() => handleParagraphClick(paragraphId)}
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
                        <p className="text-xl text-slate-800 leading-relaxed font-serif text-justify whitespace-pre-wrap">
                          {renderParagraphContent(cleanText)}
                        </p>
                      </div>
                    );
                  })}

                  {/* References Section */}
                  {Object.keys(materials).length > 0 && (
                    <div className="mt-12 pt-8 border-t border-slate-200 px-6">
                      <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                        <BookOpen className="h-5 w-5 text-primary" />
                        参考文献
                      </h3>
                      <div className="space-y-4">
                        {Object.entries(materials)
                          .sort(([a], [b]) => parseInt(a) - parseInt(b))
                          .map(([index, material]) => (
                            <div key={index} className="flex gap-4 text-sm group items-start p-3 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => setSelectedCitation(material)}>
                              <span className="font-mono text-slate-400 font-bold min-w-[24px] mt-0.5">[{index}]</span>
                              <div className="flex-1 space-y-1">
                                <div className="font-medium text-slate-900 leading-snug">
                                  {material.material_title}
                                </div>
                                {material.material_summary && (
                                  <p className="text-slate-500 text-xs line-clamp-2 leading-relaxed">
                                    {material.material_summary}
                                  </p>
                                )}
                                {material.material_url && (
                              <a 
                                href={material.material_url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-primary hover:text-primary/80 hover:underline text-xs inline-flex items-center gap-1 mt-1 font-medium transition-colors"
                                onClick={(e) => e.stopPropagation()}
                              >
                                查看全文 <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="plain" className="h-full mt-0 absolute inset-0">
              <ScrollArea className="h-full px-8 py-8">
                <div className="max-w-3xl mx-auto pb-20">
                  <div className="space-y-6 text-slate-900">
                    {paragraphs.map((paragraph, index) => {
                      // Clean paragraph marker if present in text (e.g. [P1])
                      const cleanText = paragraph.replace(/^\[P\d+\]\s*/, '');
                      
                      return (
                        <p key={index} className="text-xl leading-loose font-serif text-justify indent-8">
                          {renderParagraphContent(cleanText)}
                        </p>
                      );
                    })}
                  </div>

                  {/* References Section for Plain Text */}
                  {Object.keys(materials).length > 0 && (
                    <div className="mt-16 pt-8 border-t-2 border-slate-100">
                      <h3 className="text-lg font-bold text-slate-900 mb-6">参考文献</h3>
                      <div className="space-y-3">
                        {Object.entries(materials)
                          .sort(([a], [b]) => parseInt(a) - parseInt(b))
                          .map(([index, material]) => (
                            <div key={index} className="flex gap-3 text-sm text-slate-600 hover:text-slate-900 cursor-pointer" onClick={() => setSelectedCitation(material)}>
                              <span className="font-mono font-bold select-none">[{index}]</span>
                              <div>
                                <div className="font-medium leading-relaxed">
                                  {material.material_title}
                                </div>
                                {material.material_url && (
                                  <a 
                                    href={material.material_url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:underline text-xs inline-flex items-center gap-1 mt-1"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    查看全文
                                  </a>
                                )}
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </CardContent>
        </Tabs>
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
          <div className="flex flex-col h-full bg-slate-50/30">
            {/* Citation Detail Card */}
            {selectedCitation && (
              <div className="p-4 border-b bg-white animate-in slide-in-from-top-2 duration-300 shadow-sm relative z-20">
                <div className="flex items-center justify-between mb-3">
                  <Badge variant="default" className="bg-black hover:bg-black text-white px-3 py-1 text-xs font-bold rounded-full">
                    来源详情 [{Object.keys(materials).find(key => materials[key] === selectedCitation)}]
                  </Badge>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSelectedCitation(null)}>
                    <X className="h-4 w-4 text-slate-400" />
                  </Button>
                </div>
                
                <h3 className="text-base font-bold text-slate-900 mb-3 leading-snug line-clamp-2">
                  {selectedCitation.material_title}
                </h3>
                
                {selectedCitation.insight && (
                  <div className="bg-amber-50 rounded-lg p-3 space-y-2 mb-3 border border-amber-100">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 uppercase tracking-wider">
                      <Wand2 className="h-3 w-3" />
                      观点洞察
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed">
                      {selectedCitation.insight}
                    </p>
                  </div>
                )}
                
                <div className="bg-slate-50 rounded-lg p-3 space-y-2 mb-3 border border-slate-100">
                  <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">摘要:</div>
                  <p className="text-sm text-slate-600 leading-relaxed line-clamp-4">
                    {selectedCitation.material_summary || "暂无摘要"}
                  </p>
                </div>

                {selectedCitation.material_url && (
              <a
                href={selectedCitation.material_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors group bg-blue-50 p-2 rounded-md hover:bg-blue-100"
              >
                <ExternalLink className="h-3 w-3 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                查看全文
              </a>
            )}
              </div>
            )}
            
            <div className="flex-1 overflow-hidden relative">
              <DraftGuidance 
                guidance={annotations} 
                activeParagraphId={activeParagraphId || undefined}
                paragraphContent={activeParagraphId ? paragraphs[parseInt(activeParagraphId.replace('P', '')) - 1] : undefined}
                onUpdateParagraph={updateParagraphFromGuidance}
                onSaveToLibrary={handleSaveToLibrary}
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
