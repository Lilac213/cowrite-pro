import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  CheckCircle2, 
  ChevronDown, 
  ChevronRight, 
  FileText, 
  GraduationCap, 
  Newspaper, 
  Globe, 
  BookMarked, 
  FileEdit 
} from 'lucide-react';
import type { RetrievedMaterial, SourceType } from '@/types';
import { updateMaterialSelection, batchUpdateMaterialSelection } from '@/db/api';
import { useToast } from '@/hooks/use-toast';

interface MaterialSelectionPanelProps {
  materials: RetrievedMaterial[];
  onConfirm: () => void;
  onRefresh: () => void;
}

const sourceTypeConfig: Record<SourceType, { label: string; icon: any; color: string }> = {
  academic: { label: '学术文献', icon: GraduationCap, color: 'text-blue-600' },
  news: { label: '新闻资讯', icon: Newspaper, color: 'text-green-600' },
  web: { label: '网络资源', icon: Globe, color: 'text-purple-600' },
  user_library: { label: '参考文章库', icon: BookMarked, color: 'text-orange-600' },
  personal: { label: '个人素材', icon: FileEdit, color: 'text-pink-600' },
};

export default function MaterialSelectionPanel({ 
  materials, 
  onConfirm, 
  onRefresh 
}: MaterialSelectionPanelProps) {
  const [localMaterials, setLocalMaterials] = useState<RetrievedMaterial[]>(materials);
  const [expandedGroups, setExpandedGroups] = useState<Set<SourceType>>(new Set(['academic', 'news', 'web']));
  const [expandedMaterials, setExpandedMaterials] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  // 按来源分组
  const groupedMaterials = useMemo(() => {
    const groups: Record<SourceType, RetrievedMaterial[]> = {
      academic: [],
      news: [],
      web: [],
      user_library: [],
      personal: [],
    };

    localMaterials.forEach(material => {
      groups[material.source_type].push(material);
    });

    return groups;
  }, [localMaterials]);

  // 统计信息
  const stats = useMemo(() => {
    const total = localMaterials.length;
    const selected = localMaterials.filter(m => m.is_selected).length;
    return { total, selected };
  }, [localMaterials]);

  // 切换分组展开状态
  const toggleGroup = (sourceType: SourceType) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(sourceType)) {
        next.delete(sourceType);
      } else {
        next.add(sourceType);
      }
      return next;
    });
  };

  // 切换资料展开状态
  const toggleMaterial = (materialId: string) => {
    setExpandedMaterials(prev => {
      const next = new Set(prev);
      if (next.has(materialId)) {
        next.delete(materialId);
      } else {
        next.add(materialId);
      }
      return next;
    });
  };

  // 切换单个资料选择
  const toggleSelection = async (materialId: string) => {
    const material = localMaterials.find(m => m.id === materialId);
    if (!material) return;

    const newSelected = !material.is_selected;
    
    // 乐观更新 UI
    setLocalMaterials(prev =>
      prev.map(m => m.id === materialId ? { ...m, is_selected: newSelected } : m)
    );

    try {
      await updateMaterialSelection(materialId, newSelected);
    } catch (error: any) {
      // 回滚
      setLocalMaterials(prev =>
        prev.map(m => m.id === materialId ? { ...m, is_selected: !newSelected } : m)
      );
      toast({
        title: '更新失败',
        description: error.message || '请稍后重试',
        variant: 'destructive',
      });
    }
  };

  // 全选/取消全选某个分组
  const toggleGroupSelection = async (sourceType: SourceType) => {
    const groupMaterials = groupedMaterials[sourceType];
    if (groupMaterials.length === 0) return;

    const allSelected = groupMaterials.every(m => m.is_selected);
    const newSelected = !allSelected;

    // 乐观更新 UI
    setLocalMaterials(prev =>
      prev.map(m => 
        m.source_type === sourceType ? { ...m, is_selected: newSelected } : m
      )
    );

    try {
      await batchUpdateMaterialSelection(
        groupMaterials.map(m => ({ id: m.id, is_selected: newSelected }))
      );
    } catch (error: any) {
      // 回滚
      setLocalMaterials(materials);
      toast({
        title: '批量更新失败',
        description: error.message || '请稍后重试',
        variant: 'destructive',
      });
    }
  };

  // 全选/取消全选所有
  const toggleAllSelection = async () => {
    const allSelected = localMaterials.every(m => m.is_selected);
    const newSelected = !allSelected;

    // 乐观更新 UI
    setLocalMaterials(prev =>
      prev.map(m => ({ ...m, is_selected: newSelected }))
    );

    try {
      await batchUpdateMaterialSelection(
        localMaterials.map(m => ({ id: m.id, is_selected: newSelected }))
      );
    } catch (error: any) {
      // 回滚
      setLocalMaterials(materials);
      toast({
        title: '批量更新失败',
        description: error.message || '请稍后重试',
        variant: 'destructive',
      });
    }
  };

  // 确认选择
  const handleConfirm = () => {
    if (stats.selected === 0) {
      toast({
        title: '请选择资料',
        description: '至少选择一条资料才能继续',
        variant: 'destructive',
      });
      return;
    }

    onConfirm();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>选择研究资料</CardTitle>
              <CardDescription>
                从检索结果中选择需要的资料，AI 将基于您的选择进行综合分析
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-base">
                已选 {stats.selected} / {stats.total}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 操作按钮 */}
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={toggleAllSelection}
              >
                {localMaterials.every(m => m.is_selected) ? '取消全选' : '全选'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onRefresh}
              >
                重新搜索
              </Button>
            </div>
            <Button
              onClick={handleConfirm}
              disabled={stats.selected === 0}
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              确认选择并整理资料
            </Button>
          </div>

          <Separator />

          {/* 按来源分组显示 */}
          <div className="space-y-3">
            {(Object.keys(groupedMaterials) as SourceType[]).map(sourceType => {
              const groupMaterials = groupedMaterials[sourceType];
              if (groupMaterials.length === 0) return null;

              const config = sourceTypeConfig[sourceType];
              const Icon = config.icon;
              const isExpanded = expandedGroups.has(sourceType);
              const selectedCount = groupMaterials.filter(m => m.is_selected).length;
              const allSelected = selectedCount === groupMaterials.length;

              return (
                <Card key={sourceType} className="border-l-4" style={{ borderLeftColor: `var(--${sourceType})` }}>
                  <CardHeader className="py-3">
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => toggleGroup(sourceType)}
                        className="flex items-center gap-2 flex-1 text-left hover:opacity-70 transition-opacity"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        <Icon className={`h-5 w-5 ${config.color}`} />
                        <span className="font-semibold">{config.label}</span>
                        <Badge variant="secondary">
                          {selectedCount} / {groupMaterials.length}
                        </Badge>
                      </button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleGroupSelection(sourceType)}
                      >
                        {allSelected ? '取消全选' : '全选'}
                      </Button>
                    </div>
                  </CardHeader>

                  {isExpanded && (
                    <CardContent className="pt-0 space-y-2">
                      {groupMaterials.map(material => {
                        const isExpanded = expandedMaterials.has(material.id);
                        
                        return (
                          <Card key={material.id} className={material.is_selected ? 'border-primary' : ''}>
                            <CardContent className="p-4">
                              <div className="flex items-start gap-3">
                                <Checkbox
                                  checked={material.is_selected}
                                  onCheckedChange={() => toggleSelection(material.id)}
                                  className="mt-1"
                                />
                                <div className="flex-1 space-y-2">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1">
                                      <h4 className="font-medium leading-tight">{material.title}</h4>
                                      {material.authors && (
                                        <p className="text-sm text-muted-foreground mt-1">
                                          {material.authors}
                                          {material.year && ` (${material.year})`}
                                        </p>
                                      )}
                                      {material.citation_count !== undefined && material.citation_count > 0 && (
                                        <Badge variant="outline" className="mt-1">
                                          引用 {material.citation_count}
                                        </Badge>
                                      )}
                                    </div>
                                    {material.full_text && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => toggleMaterial(material.id)}
                                      >
                                        {isExpanded ? (
                                          <>
                                            <ChevronDown className="h-4 w-4 mr-1" />
                                            收起
                                          </>
                                        ) : (
                                          <>
                                            <ChevronRight className="h-4 w-4 mr-1" />
                                            查看原文
                                          </>
                                        )}
                                      </Button>
                                    )}
                                  </div>

                                  {material.abstract && (
                                    <p className="text-sm text-muted-foreground line-clamp-3">
                                      {material.abstract}
                                    </p>
                                  )}

                                  {material.url && (
                                    <a
                                      href={material.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                                    >
                                      <FileText className="h-3 w-3" />
                                      查看来源
                                    </a>
                                  )}

                                  {isExpanded && material.full_text && (
                                    <div className="mt-3 p-3 bg-muted rounded-md">
                                      <h5 className="text-sm font-semibold mb-2">原文内容</h5>
                                      <div className="text-sm text-muted-foreground whitespace-pre-wrap max-h-96 overflow-y-auto">
                                        {material.full_text}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
