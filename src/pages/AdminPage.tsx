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
      toast({
        title: '保存成功',
        description: '系统配置已更新',
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
              <CardTitle>LLM 配置</CardTitle>
              <CardDescription>配置全局 LLM 服务（通义千问）</CardDescription>
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>搜索配置</CardTitle>
              <CardDescription>配置全局搜索服务（OpenAlex）</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="search-provider">搜索提供商</Label>
                <Input
                  id="search-provider"
                  value="OpenAlex"
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  系统默认使用 OpenAlex 作为搜索提供商（免费开放 API）
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="search-api-key">API 密钥（可选）</Label>
                <Input
                  id="search-api-key"
                  type="password"
                  placeholder="OpenAlex 不需要 API 密钥"
                  value={systemConfig.search_api_key || ''}
                  onChange={(e) => setSystemConfig({ ...systemConfig, search_api_key: e.target.value })}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  OpenAlex 是开放 API，无需配置密钥
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
