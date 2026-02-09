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
import { LogOut, User as UserIcon, ShoppingCart, Star } from 'lucide-react';

export default function SettingsPage() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const { toast } = useToast();

  // 积分套餐配置
  const creditPackages = [
    { name: '体验包', credits: 16, price: 9.9, aiReducer: 5, projects: 3 },
    { name: '推荐包', credits: 66, price: 29.9, aiReducer: 20, projects: 10, recommended: true },
    { name: '进阶包', credits: 166, price: 79.9, aiReducer: 50, projects: 25 },
    { name: '专业包', credits: 366, price: 149.9, aiReducer: 100, projects: 50 },
  ];

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

  const handlePurchase = (pkg: typeof creditPackages[0]) => {
    toast({
      title: '功能开发中',
      description: `您选择了 ${pkg.name}（¥${pkg.price}），支付功能即将上线`,
    });
    setPurchaseDialogOpen(false);
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

            {/* 使用情况统计 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
              <div className="p-4 border rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">积分余额</p>
                <p className="text-2xl font-bold">{profile?.credits || 0} 点</p>
              </div>
              <div className="p-4 border rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">AI降重</p>
                <p className="text-2xl font-bold">
                  {profile?.ai_reducer_used || 0}/{profile?.ai_reducer_limit || 0}
                </p>
              </div>
              <div className="p-4 border rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">项目数量</p>
                <p className="text-2xl font-bold">
                  {profile?.projects_created || 0}/{profile?.project_limit || 0}
                </p>
              </div>
            </div>

            {/* 购买点数按钮 */}
            <Dialog open={purchaseDialogOpen} onOpenChange={setPurchaseDialogOpen}>
              <DialogTrigger asChild>
                <Button className="w-full mt-4">
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  购买点数
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl">
                <DialogHeader>
                  <DialogTitle>购买点数</DialogTitle>
                  <DialogDescription>
                    选择适合您的套餐，增加AI降重次数和项目数量
                  </DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 py-6">
                  {creditPackages.map((pkg) => (
                    <Card 
                      key={pkg.name} 
                      className={`relative ${pkg.recommended ? 'border-primary border-2' : ''}`}
                    >
                      {pkg.recommended && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1">
                          <Star className="h-3 w-3 fill-current" />
                          最多人选择
                        </div>
                      )}
                      <CardHeader className="text-center pb-4">
                        <CardTitle className="text-lg">{pkg.name}</CardTitle>
                        {pkg.recommended && (
                          <Badge variant="default" className="w-fit mx-auto mt-1">
                            ⭐
                          </Badge>
                        )}
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="text-center">
                          <p className="text-3xl font-bold">¥{pkg.price}</p>
                          <p className="text-sm text-muted-foreground mt-1 flex items-center justify-center gap-1">
                            <span className="inline-block w-2 h-2 rounded-full bg-primary"></span>
                            {pkg.credits} 点
                          </p>
                        </div>
                        <div className="space-y-2 text-sm text-muted-foreground">
                          <p>• AI降重 +{pkg.aiReducer} 次</p>
                          <p>• 项目数 +{pkg.projects} 个</p>
                        </div>
                        <Button 
                          className="w-full"
                          variant={pkg.recommended ? 'default' : 'outline'}
                          onClick={() => handlePurchase(pkg)}
                        >
                          {pkg.recommended ? '立即购买' : '购买'}
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                <div className="text-center text-sm text-muted-foreground">
                  <p>💡 参考用量</p>
                  <p className="mt-1">• 1次AI降重 ≈ 处理1篇文章</p>
                  <p>• 1个项目 = 1篇完整的写作任务</p>
                </div>
              </DialogContent>
            </Dialog>
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
