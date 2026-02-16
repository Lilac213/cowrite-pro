import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/db/supabase';
import { useInvitationCode } from '@/api';

export default function LoginPage() {
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [registerUsername, setRegisterUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [invitationCode, setInvitationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const { signInWithUsernameOrEmail, signUpWithEmail } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const from = (location.state as any)?.from || '/';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await signInWithUsernameOrEmail(usernameOrEmail, password);
      if (error) {
        toast({
          title: '登录失败',
          description: error.message,
          variant: 'destructive',
        });
      } else {
        navigate(from, { replace: true });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!/^[a-zA-Z0-9_]+$/.test(registerUsername)) {
        toast({
          title: '注册失败',
          description: '用户名只能包含字母、数字和下划线',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        toast({
          title: '注册失败',
          description: '请输入有效的邮箱地址',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      const { data: existingUser } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', registerUsername)
        .maybeSingle();

      if (existingUser) {
        toast({
          title: '注册失败',
          description: '用户名已被使用，请换一个',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      const { error, userId } = await signUpWithEmail(registerUsername, email, password);
      if (error) {
        toast({
          title: '注册失败',
          description: error.message,
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      if (invitationCode && userId) {
        try {
          await useInvitationCode(invitationCode, userId);
          toast({
            title: '注册成功',
            description: '邀请码已生效，请查收验证邮件',
          });
        } catch (inviteError: any) {
          toast({
            title: '注册成功',
            description: `邀请码无效：${inviteError.message}，请查收验证邮件`,
          });
        }
      } else {
        toast({
          title: '注册成功',
          description: '验证邮件已发送到您的邮箱，请点击链接完成验证后登录',
        });
      }

      setTimeout(() => {
        setRegisterUsername('');
        setEmail('');
        setPassword('');
        setInvitationCode('');
      }, 1000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2">
          <CardTitle className="text-3xl font-bold text-center">CoWrite</CardTitle>
          <CardDescription className="text-center">写作辅助工具</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">登录</TabsTrigger>
              <TabsTrigger value="register">注册</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-username">用户名或邮箱</Label>
                  <Input
                    id="login-username"
                    type="text"
                    placeholder="请输入用户名或邮箱"
                    value={usernameOrEmail}
                    onChange={(e) => setUsernameOrEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">密码</Label>
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="请输入密码"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? '登录中...' : '登录'}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="register">
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="register-username">用户名</Label>
                  <Input
                    id="register-username"
                    type="text"
                    placeholder="只能包含字母、数字和下划线"
                    value={registerUsername}
                    onChange={(e) => setRegisterUsername(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-email">邮箱</Label>
                  <Input
                    id="register-email"
                    type="email"
                    placeholder="请输入邮箱地址"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-password">密码</Label>
                  <Input
                    id="register-password"
                    type="password"
                    placeholder="请输入密码（至少6位）"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invitation-code">邀请码（可选）</Label>
                  <Input
                    id="invitation-code"
                    type="text"
                    placeholder="如有邀请码请填写"
                    value={invitationCode}
                    onChange={(e) => setInvitationCode(e.target.value.toUpperCase())}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? '注册中...' : '注册'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
