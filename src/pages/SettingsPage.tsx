import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { getProfile, updateProfile } from '@/db/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/db/supabase';
import { LogOut, User as UserIcon } from 'lucide-react';

export default function SettingsPage() {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const [llmProvider, setLlmProvider] = useState('');
  const [llmApiKey, setLlmApiKey] = useState('');
  const [searchProvider, setSearchProvider] = useState('');
  const [searchApiKey, setSearchApiKey] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
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
        description: 'API 配置已更新',
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

  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) {
      toast({
        title: '请填写完整',
        description: '请输入新密码和确认密码',
        variant: 'destructive',
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: '密码不匹配',
        description: '两次输入的密码不一致',
        variant: 'destructive',
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: '密码太短',
        description: '密码至少需要 6 个字符',
        variant: 'destructive',
      });
      return;
    }

    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      setNewPassword('');
      setConfirmPassword('');
      toast({
        title: '密码已更新',
        description: '您的密码已成功修改',
      });
    } catch (error: any) {
      toast({
        title: '修改失败',
        description: error.message || '无法修改密码',
        variant: 'destructive',
      });
    } finally {
      setChangingPassword(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
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
        {/* 用户信息 */}
        <Card>
          <CardHeader>
            <CardTitle>用户信息</CardTitle>
            <CardDescription>您的账户基本信息</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
              <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-primary-foreground">
                <UserIcon className="h-6 w-6" />
              </div>
              <div>
                <p className="font-medium">{profile?.username || user?.email}</p>
                <p className="text-sm text-muted-foreground">
                  {profile?.role === 'admin' ? '管理员' : '用户'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 密码修改 */}
        <Card>
          <CardHeader>
            <CardTitle>修改密码</CardTitle>
            <CardDescription>更新您的登录密码</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">新密码</Label>
              <Input
                id="newPassword"
                type="password"
                placeholder="输入新密码（至少 6 个字符）"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">确认密码</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="再次输入新密码"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            <Button onClick={handleChangePassword} disabled={changingPassword}>
              {changingPassword ? '修改中...' : '修改密码'}
            </Button>
          </CardContent>
        </Card>

        <Separator />

        {/* LLM 配置 */}
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

        {/* 搜索配置 */}
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

        <div className="flex justify-between items-center pt-4">
          <Button variant="outline" onClick={handleSignOut}>
            <LogOut className="h-4 w-4 mr-2" />
            退出登录
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? '保存中...' : '保存设置'}
          </Button>
        </div>
      </div>
    </div>
  );
}
