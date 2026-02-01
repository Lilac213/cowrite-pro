import { useState, useEffect } from 'react';
import { getKnowledgeBase, createKnowledgeBase, updateKnowledgeBase, updateProject, callWebSearch } from '@/db/api';
import type { KnowledgeBase } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface KnowledgeStageProps {
  projectId: string;
  onComplete: () => void;
}

export default function KnowledgeStage({ projectId, onComplete }: KnowledgeStageProps) {
  const [knowledge, setKnowledge] = useState<KnowledgeBase[]>([]);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadKnowledge();
  }, [projectId]);

  const loadKnowledge = async () => {
    try {
      const data = await getKnowledgeBase(projectId);
      setKnowledge(data);
    } catch (error) {
      console.error('加载知识库失败:', error);
    }
  };

  const handleSearch = async () => {
    if (!query.trim()) return;

    setSearching(true);
    try {
      const results = await callWebSearch(query);
      
      for (const result of results) {
        await createKnowledgeBase({
          project_id: projectId,
          title: result.title,
          content: result.content,
          source: result.source,
          source_url: result.url,
          published_at: result.publishedAt || undefined,
          collected_at: new Date().toISOString(),
          next_update_suggestion: '建议 30 天后更新',
          selected: false,
          keywords: [],
        });
      }

      await loadKnowledge();
      toast({
        title: '搜索成功',
        description: `找到 ${results.length} 条结果`,
      });
    } catch (error: any) {
      toast({
        title: '搜索失败',
        description: error.message || '无法搜索信息',
        variant: 'destructive',
      });
    } finally {
      setSearching(false);
    }
  };

  const handleToggleSelect = async (id: string, selected: boolean) => {
    try {
      await updateKnowledgeBase(id, { selected: !selected });
      await loadKnowledge();
    } catch (error) {
      toast({
        title: '更新失败',
        variant: 'destructive',
      });
    }
  };

  const handleConfirm = async () => {
    const selectedCount = knowledge.filter((k) => k.selected).length;
    if (selectedCount === 0) {
      toast({
        title: '请至少选择一条信息',
        variant: 'destructive',
      });
      return;
    }

    setConfirming(true);
    try {
      await updateProject(projectId, { status: 'outline_confirmed' });
      toast({
        title: '确认成功',
        description: '进入下一阶段',
      });
      onComplete();
    } catch (error) {
      toast({
        title: '确认失败',
        variant: 'destructive',
      });
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>资料查询</CardTitle>
          <CardDescription>搜索相关信息并选择需要的内容</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="输入搜索关键词"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSearch();
                }
              }}
            />
            <Button onClick={handleSearch} disabled={searching || !query.trim()}>
              <Search className="h-4 w-4 mr-2" />
              {searching ? '搜索中...' : '搜索'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {knowledge.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>搜索结果</CardTitle>
            <CardDescription>
              已选择 {knowledge.filter((k) => k.selected).length} / {knowledge.length} 条
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {knowledge.map((item) => (
              <Card key={item.id} className="p-4">
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={item.selected}
                    onCheckedChange={() => handleToggleSelect(item.id, item.selected)}
                  />
                  <div className="flex-1 space-y-2">
                    <h4 className="font-semibold">{item.title}</h4>
                    <p className="text-sm text-muted-foreground">{item.content}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline">{item.source}</Badge>
                      {item.published_at && (
                        <span>{new Date(item.published_at).toLocaleDateString('zh-CN')}</span>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
            <div className="flex justify-end">
              <Button onClick={handleConfirm} disabled={confirming}>
                {confirming ? '确认中...' : '确认选择'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
