import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getProfile, updateProfile } from '@/db/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

export default function SettingsPage() {
  const { user, refreshProfile } = useAuth();
  const [llmProvider, setLlmProvider] = useState('');
  const [llmApiKey, setLlmApiKey] = useState('');
  const [searchProvider, setSearchProvider] = useState('');
  const [searchApiKey, setSearchApiKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadSettings();
  }, [user]);

  const loadSettings = async () => {
    if (!user) return;
    try {
      const profile = await getProfile(user.id);
      if (profile) {
        setLlmProvider(profile.llm_provider || '');
        setLlmApiKey(profile.llm_api_key || '');
        setSearchProvider(profile.search_provider || '');
        setSearchApiKey(profile.search_api_key || '');
      }
    } catch (error) {
      toast({
        title: '加载失败',
        description: '无法加载设置',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    try {
      await updateProfile(user.id, {
        llm_provider: llmProvider || undefined,
        llm_api_key: llmApiKey || undefined,
        search_provider: searchProvider || undefined,
        search_api_key: searchApiKey || undefined,
      });
      await refreshProfile();
      toast({
        title: '保存成功',
        description: '设置已更新',
      });
    } catch (error) {
      toast({
        title: '保存失败',
        description: '无法保存设置',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">设置</h1>
        <p className="text-muted-foreground mt-2">配置您的 API 密钥和偏好设置</p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>LLM 配置</CardTitle>
            <CardDescription>
              配置大语言模型 API，用于 AI 内容生成功能
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="llm-provider">LLM 提供商</Label>
              <Select value={llmProvider} onValueChange={setLlmProvider}>
                <SelectTrigger id="llm-provider">
                  <SelectValue placeholder="选择 LLM 提供商" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="llm-api-key">LLM API 密钥</Label>
              <Input
                id="llm-api-key"
                type="password"
                placeholder="请输入 API 密钥"
                value={llmApiKey}
                onChange={(e) => setLlmApiKey(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {llmProvider === 'openai' && '在 OpenAI 平台获取：https://platform.openai.com/api-keys'}
                {llmProvider === 'anthropic' && '在 Anthropic 控制台获取：https://console.anthropic.com/'}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>搜索配置</CardTitle>
            <CardDescription>
              配置搜索 API，用于实时信息查询功能
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="search-provider">搜索提供商</Label>
              <Select value={searchProvider} onValueChange={setSearchProvider}>
                <SelectTrigger id="search-provider">
                  <SelectValue placeholder="选择搜索提供商" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="google">Google Custom Search</SelectItem>
                  <SelectItem value="bing">Bing Search API</SelectItem>
                  <SelectItem value="perplexity">Perplexity AI</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="search-api-key">搜索 API 密钥</Label>
              <Input
                id="search-api-key"
                type="password"
                placeholder="请输入 API 密钥"
                value={searchApiKey}
                onChange={(e) => setSearchApiKey(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {searchProvider === 'google' && '在 Google Cloud Console 获取：https://console.cloud.google.com/'}
                {searchProvider === 'bing' && '在 Azure Portal 获取：https://portal.azure.com/'}
                {searchProvider === 'perplexity' && '在 Perplexity 获取：https://www.perplexity.ai/'}
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? '保存中...' : '保存设置'}
          </Button>
        </div>
      </div>
    </div>
  );
}
