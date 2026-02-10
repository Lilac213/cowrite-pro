import { useEffect, useState } from 'react';
import { getAllProfiles, updateProfile, getSystemConfig, updateSystemConfig, getAllInvitationCodes, createInvitationCode, deactivateInvitationCode, setUserCredits } from '@/db/api';
import type { Profile, SystemConfig, InvitationCode } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/db/supabase';
import { Copy, Plus, Ban, Edit } from 'lucide-react';

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
  const [invitationCodes, setInvitationCodes] = useState<InvitationCode[]>([]);
  const [systemConfig, setSystemConfig] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creditDialogOpen, setCreditDialogOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [newCredits, setNewCredits] = useState(0);
  const [newCodeCredits, setNewCodeCredits] = useState(100);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [profilesData, configData, codesData] = await Promise.all([
        getAllProfiles(),
        getSystemConfig(),
        getAllInvitationCodes(),
      ]);
      setProfiles(profilesData);
      setInvitationCodes(codesData);
      
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
        updateSystemConfig('llm_provider', systemConfig.llm_provider || 'siliconflow'),
        updateSystemConfig('llm_api_key', systemConfig.llm_api_key || ''),
        updateSystemConfig('search_provider', systemConfig.search_provider || 'serpapi'),
        updateSystemConfig('serpapi_api_key', systemConfig.serpapi_api_key || ''),
      ]);
      
      toast({
        title: '保存成功',
        description: '系统配置已更新，立即生效',
      });
    } catch (error) {
      toast({
        title: '保存失败',
        description: '无法保存配置，请稍后重试',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateCode = async () => {
    setGenerating(true);
    try {
      const newCode = await createInvitationCode(newCodeCredits);
      setInvitationCodes([newCode, ...invitationCodes]);
      setDialogOpen(false);
      toast({
        title: '生成成功',
        description: `邀请码：${newCode.code}`,
      });
    } catch (error) {
      toast({
        title: '生成失败',
        variant: 'destructive',
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleSetUserCredits = async () => {
    if (!selectedUser) return;
    try {
      await setUserCredits(selectedUser.id, newCredits);
      setProfiles(profiles.map(p => 
        p.id === selectedUser.id ? { ...p, available_credits: newCredits } : p
      ));
      setCreditDialogOpen(false);
      toast({
        title: '设置成功',
        description: `已为 ${selectedUser.username} 设置 ${newCredits} 点数`,
      });
    } catch (error) {
      toast({
        title: '设置失败',
        variant: 'destructive',
      });
    }
  };

  const openCreditDialog = (user: Profile) => {
    setSelectedUser(user);
    setNewCredits(user.available_credits);
    setCreditDialogOpen(true);
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({
      title: '已复制',
      description: `邀请码 ${code} 已复制到剪贴板`,
    });
  };

  const handleDeactivateCode = async (codeId: string) => {
    try {
      await deactivateInvitationCode(codeId);
      setInvitationCodes(invitationCodes.map(c => 
        c.id === codeId ? { ...c, is_active: false } : c
      ));
      toast({
        title: '停用成功',
      });
    } catch (error) {
      toast({
        title: '停用失败',
        variant: 'destructive',
      });
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
          <TabsTrigger value="invitations">邀请码管理</TabsTrigger>
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
                  value="SiliconFlow (Qwen/Qwen2.5-7B-Instruct)"
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  系统使用 SiliconFlow 平台提供的通义千问模型
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="llm-api-key">API 密钥</Label>
                <Input
                  id="llm-api-key"
                  type="password"
                  placeholder="输入 SiliconFlow API 密钥（格式：sk-xxx）"
                  value={systemConfig.llm_api_key || ''}
                  onChange={(e) => setSystemConfig({ ...systemConfig, llm_api_key: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  在 SiliconFlow 控制台获取：
                  <a 
                    href="https://cloud.siliconflow.cn" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline ml-1"
                  >
                    https://cloud.siliconflow.cn
                  </a>
                </p>
                <p className="text-xs text-amber-600">
                  💡 提示：注册后在"API 密钥"页面创建新密钥，复制完整的密钥字符串（通常以 sk- 开头）
                </p>
              </div>
              
              {/* 配置说明 */}
              <div className="p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-blue-900 dark:text-blue-100">
                  <span>✅</span>
                  <span>自动生效</span>
                </div>
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  保存后，API 密钥将立即生效，无需额外配置或重启服务。
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  Research Synthesis Agent 会自动从数据库读取最新的 API 密钥。
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>搜索配置</CardTitle>
              <CardDescription>配置全局搜索服务（SerpAPI - Google Scholar、Google Search、Google News）</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* SerpAPI 配置 */}
              <div className="space-y-4 p-4 border rounded-lg">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">SerpAPI</h3>
                  <Badge variant={systemConfig.serpapi_api_key ? 'default' : 'outline'}>
                    {systemConfig.serpapi_api_key ? '已配置' : '未配置'}
                  </Badge>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="serpapi-status">状态</Label>
                  <Input
                    id="serpapi-status"
                    value={systemConfig.serpapi_api_key ? '已启用' : '未启用'}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">
                    SerpAPI 提供 Google Scholar（学术搜索）、Google Search（网页搜索）、Google News（新闻搜索）的统一 API 接口
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="serpapi-api-key">API 密钥</Label>
                  <Input
                    id="serpapi-api-key"
                    type="password"
                    placeholder="请输入 SerpAPI Key"
                    value={systemConfig.serpapi_api_key || ''}
                    onChange={(e) => setSystemConfig({ ...systemConfig, serpapi_api_key: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    可在 <a href="https://serpapi.com/manage-api-key" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">SerpAPI 官网</a> 获取 API 密钥
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>支持的搜索引擎</Label>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">Google Scholar</Badge>
                    <Badge variant="secondary">Google Search</Badge>
                    <Badge variant="secondary">Google News</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    通过 SerpAPI 统一调用多个 Google 搜索引擎，获取学术文献、网页内容和新闻资讯
                  </p>
                </div>
              </div>

              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <strong>说明：</strong>系统使用 SerpAPI 提供的 Google 搜索服务，包括学术文献搜索（Google Scholar）、网页搜索（Google Search）和新闻搜索（Google News），提供全面的信息检索能力。
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
                    <TableHead>可用点数</TableHead>
                    <TableHead>AI降重使用</TableHead>
                    <TableHead>项目创建</TableHead>
                    <TableHead>邀请码</TableHead>
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
                        {profile.unlimited_credits ? (
                          <Badge variant="default">无限</Badge>
                        ) : (
                          `${profile.available_credits} 点`
                        )}
                      </TableCell>
                      <TableCell>{profile.ai_reducer_used} 次</TableCell>
                      <TableCell>{profile.projects_created} 个</TableCell>
                      <TableCell>
                        {profile.invitation_code ? (
                          <span className="font-mono text-sm">{profile.invitation_code}</span>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {new Date(profile.created_at).toLocaleDateString('zh-CN')}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
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
                          {!profile.unlimited_credits && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openCreditDialog(profile)}
                            >
                              <Edit className="h-3 w-3 mr-1" />
                              配置点数
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* 配置点数对话框 */}
          <Dialog open={creditDialogOpen} onOpenChange={setCreditDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>配置用户点数</DialogTitle>
                <DialogDescription>
                  为 {selectedUser?.username} 设置可用点数
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="credits">可用点数</Label>
                  <Input
                    id="credits"
                    type="number"
                    min="0"
                    value={newCredits}
                    onChange={(e) => setNewCredits(parseInt(e.target.value) || 0)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreditDialogOpen(false)}>
                  取消
                </Button>
                <Button onClick={handleSetUserCredits}>
                  确定
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="invitations">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>邀请码管理</CardTitle>
                  <CardDescription>生成和管理邀请码</CardDescription>
                </div>
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      生成邀请码
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>生成新邀请码</DialogTitle>
                      <DialogDescription>
                        设置邀请码的使用限制
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="code-credits">赠送点数</Label>
                        <Input
                          id="code-credits"
                          type="number"
                          min="0"
                          value={newCodeCredits}
                          onChange={(e) => setNewCodeCredits(parseInt(e.target.value) || 0)}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setDialogOpen(false)}>
                        取消
                      </Button>
                      <Button onClick={handleGenerateCode} disabled={generating}>
                        {generating ? '生成中...' : '生成'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>邀请码</TableHead>
                    <TableHead>赠送点数</TableHead>
                    <TableHead>使用次数</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>创建时间</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invitationCodes.map((code) => (
                    <TableRow key={code.id}>
                      <TableCell className="font-mono font-bold">{code.code}</TableCell>
                      <TableCell>{code.credits} 点</TableCell>
                      <TableCell>{code.used_count}</TableCell>
                      <TableCell>
                        <Badge variant={code.is_active ? 'default' : 'secondary'}>
                          {code.is_active ? '有效' : '已停用'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(code.created_at).toLocaleDateString('zh-CN')}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCopyCode(code.code)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                          {code.is_active && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeactivateCode(code.id)}
                            >
                              <Ban className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
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
