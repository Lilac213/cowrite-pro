import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/db/supabase';
import { useInvitationCode } from '@/api';
import { LogOut, User as UserIcon, Gift } from 'lucide-react';

export default function SettingsPage() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [invitationCode, setInvitationCode] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [applyingCode, setApplyingCode] = useState(false);
  const { toast} = useToast();

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

  const handleApplyInvitationCode = async () => {
    if (!user || !invitationCode) return;
    
    setApplyingCode(true);
    try {
      await useInvitationCode(invitationCode, user.id);
      toast({
        title: '邀请码已生效',
        description: '点数已充值到您的账户',
      });
      setInvitationCode('');
      // 刷新用户信息
      if (refreshProfile) {
        await refreshProfile();
      }
    } catch (error: any) {
      toast({
        title: '邀请码无效',
        description: error.message || '请检查邀请码是否正确',
        variant: 'destructive',
      });
    } finally {
      setApplyingCode(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">设置</h1>
        <p className="text-muted-foreground mt-2">管理您的账户设置</p>
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
              <div className="flex-1">
                <p className="font-medium">{profile?.username || user?.email}</p>
                <p className="text-sm text-muted-foreground">
                  {profile?.role === 'admin' ? '管理员' : '用户'}
                </p>
              </div>
            </div>

            {/* 使用情况统计 - 单行显示 */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-6">
                <div>
                  <p className="text-sm text-muted-foreground">可用点数</p>
                  <p className="text-lg font-bold">
                    {profile?.unlimited_credits ? (
                      <Badge variant="default">无限</Badge>
                    ) : (
                      `${profile?.available_credits || 0} 点`
                    )}
                  </p>
                </div>
                <div className="h-8 w-px bg-border" />
                <div>
                  <p className="text-sm text-muted-foreground">AI降重</p>
                  <p className="text-lg font-bold">{profile?.ai_reducer_used || 0} 次</p>
                </div>
                <div className="h-8 w-px bg-border" />
                <div>
                  <p className="text-sm text-muted-foreground">项目数量</p>
                  <p className="text-lg font-bold">{profile?.projects_created || 0} 个</p>
                </div>
              </div>
            </div>

            {/* 邀请码输入 - 支持多次使用 */}
            <div className="p-4 border rounded-lg bg-muted/50">
              <div className="flex items-center gap-2 mb-2">
                <Gift className="h-4 w-4 text-primary" />
                <p className="text-sm font-medium">使用邀请码</p>
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="输入邀请码获取点数"
                  value={invitationCode}
                  onChange={(e) => setInvitationCode(e.target.value.toUpperCase())}
                  disabled={applyingCode}
                />
                <Button 
                  onClick={handleApplyInvitationCode}
                  disabled={!invitationCode || applyingCode}
                >
                  {applyingCode ? '验证中...' : '使用'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">可多次使用邀请码，点数将叠加</p>
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

        {/* 系统配置提示 */}
        {profile?.role === 'admin' && (
          <Card className="border-primary">
            <CardHeader>
              <CardTitle>系统配置</CardTitle>
              <CardDescription>
                您是管理员，可以在管理面板中配置全局 LLM 和搜索服务
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => navigate('/admin')}>
                前往管理面板
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-start items-center pt-4">
          <Button variant="outline" onClick={handleSignOut}>
            <LogOut className="h-4 w-4 mr-2" />
            退出登录
          </Button>
        </div>
      </div>
    </div>
  );
}
