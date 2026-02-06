import { useEffect, useState } from 'react';
import { getAllProfiles, updateProfile, getSystemConfig, updateSystemConfig } from '@/db/api';
import type { Profile, SystemConfig } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/db/supabase';

// 同步配置到 Edge Function Secrets
async function syncConfigToSecrets() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('未登录');
  }

  const { data, error } = await supabase.functions.invoke('sync-config-to-secrets', {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (error) {
    console.error('同步配置失败:', error);
    throw error;
  }

  return data;
}

export default function AdminPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [systemConfig, setSystemConfig] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [profilesData, configData] = await Promise.all([
        getAllProfiles(),
        getSystemConfig(),
      ]);
      setProfiles(profilesData);
      
      // 将配置数组转换为对象
      const configMap = configData.reduce((acc, item) => {
        acc[item.config_key] = item.config_value;
        return acc;
      }, {} as Record<string, string>);
      setSystemConfig(configMap);
    } catch (error) {
      toast({
        title: '加载失败',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: 'user' | 'admin') => {
    try {
      await updateProfile(userId, { role: newRole });
      setProfiles(profiles.map((p) => (p.id === userId ? { ...p, role: newRole } : p)));
      toast({
        title: '更新成功',
      });
    } catch (error) {
      toast({
        title: '更新失败',
        variant: 'destructive',
      });
    }
  };

  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      await Promise.all([
        updateSystemConfig('llm_provider', systemConfig.llm_provider || 'qwen'),
        updateSystemConfig('llm_api_key', systemConfig.llm_api_key || ''),
        updateSystemConfig('search_provider', systemConfig.search_provider || 'openalex'),
        updateSystemConfig('search_api_key', systemConfig.search_api_key || ''),
      ]);
      
      // 同步配置到 Edge Function Secrets
      await syncConfigToSecrets();
      
      toast({
        title: '保存成功',
        description: '系统配置已更新并同步到 Edge Functions',
      });
    } catch (error) {
      toast({
        title: '保存失败',
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
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">管理面板</h1>
        <p className="text-muted-foreground mt-2">管理系统配置和用户权限</p>
      </div>

      <Tabs defaultValue="system" className="space-y-6">
        <TabsList>
          <TabsTrigger value="system">系统配置</TabsTrigger>
          <TabsTrigger value="users">用户管理</TabsTrigger>
        </TabsList>

        <TabsContent value="system" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>LLM 配置</CardTitle>
                  <CardDescription>配置全局 LLM 服务（通义千问）</CardDescription>
                </div>
                <Badge variant={systemConfig.llm_api_key ? 'default' : 'outline'}>
                  {systemConfig.llm_api_key ? '✓ 已配置' : '未配置'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="llm-provider">LLM 提供商</Label>
                <Input
                  id="llm-provider"
                  value="通义千问 (Qwen)"
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  系统默认使用通义千问作为 LLM 提供商
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="llm-api-key">API 密钥</Label>
                <Input
                  id="llm-api-key"
                  type="password"
                  placeholder="输入通义千问 API 密钥"
                  value={systemConfig.llm_api_key || ''}
                  onChange={(e) => setSystemConfig({ ...systemConfig, llm_api_key: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  在阿里云控制台获取：https://dashscope.console.aliyun.com/
                </p>
              </div>
              
              {/* 同步状态提示 */}
              <div className="p-3 bg-muted rounded-lg space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <span>🔄</span>
                  <span>Edge Function 同步</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  保存配置后，API 密钥将自动同步到 Edge Functions（QIANWEN_API_KEY）
                </p>
                <p className="text-xs text-muted-foreground">
                  ⚠️ INTEGRATIONS_API_KEY（搜索服务密钥）需要平台管理员单独配置
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>搜索配置</CardTitle>
              <CardDescription>配置全局搜索服务（OpenAlex、Tavily）</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* OpenAlex 配置 */}
              <div className="space-y-4 p-4 border rounded-lg">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">OpenAlex API</h3>
                  <Badge variant="secondary">学术论文搜索</Badge>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="openalex-status">状态</Label>
                  <Input
                    id="openalex-status"
                    value="已启用"
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">
                    OpenAlex 是免费开放的学术搜索 API，用于搜索权威学术论文
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="openalex-api-key">API 密钥</Label>
                  <Input
                    id="openalex-api-key"
                    type="password"
                    placeholder="OpenAlex 不需要 API 密钥"
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">
                    OpenAlex 是开放 API，无需配置密钥即可使用
                  </p>
                </div>
              </div>

              {/* Tavily 配置 */}
              <div className="space-y-4 p-4 border rounded-lg">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">Tavily API</h3>
                  <Badge variant={systemConfig.tavily_api_key ? 'default' : 'outline'}>
                    {systemConfig.tavily_api_key ? '已配置' : '未配置'}
                  </Badge>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tavily-status">状态</Label>
                  <Input
                    id="tavily-status"
                    value={systemConfig.tavily_api_key ? '已启用' : '未启用'}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">
                    Tavily 提供高质量的实时搜索结果，用于补充学术论文搜索
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tavily-api-key">API 密钥</Label>
                  <Input
                    id="tavily-api-key"
                    type="password"
                    placeholder="请输入 Tavily API Key"
                    value={systemConfig.tavily_api_key || ''}
                    onChange={(e) => setSystemConfig({ ...systemConfig, tavily_api_key: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    可在 <a href="https://tavily.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Tavily 官网</a> 获取 API 密钥
                  </p>
                </div>
              </div>

              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <strong>说明：</strong>系统使用双引擎搜索策略，OpenAlex 用于学术论文搜索（免费），Tavily 用于实时内容和观点搜索（需配置 API 密钥）。
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleSaveConfig} disabled={saving}>
              {saving ? '保存中...' : '保存配置'}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>用户列表</CardTitle>
              <CardDescription>查看和管理所有用户</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>用户名</TableHead>
                    <TableHead>角色</TableHead>
                    <TableHead>注册时间</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profiles.map((profile) => (
                    <TableRow key={profile.id}>
                      <TableCell className="font-medium">{profile.username}</TableCell>
                      <TableCell>
                        <Badge variant={profile.role === 'admin' ? 'default' : 'secondary'}>
                          {profile.role === 'admin' ? '管理员' : '用户'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(profile.created_at).toLocaleDateString('zh-CN')}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={profile.role}
                          onValueChange={(value: string) => handleRoleChange(profile.id, value as 'user' | 'admin')}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="user">用户</SelectItem>
                            <SelectItem value="admin">管理员</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
