import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/db/supabase';
import { LogOut, User as UserIcon } from 'lucide-react';

export default function SettingsPage() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const { toast } = useToast();

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
