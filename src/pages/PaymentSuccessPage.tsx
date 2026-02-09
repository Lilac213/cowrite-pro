import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/db/supabase';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

export default function PaymentSuccessPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [verifying, setVerifying] = useState(true);
  const [verified, setVerified] = useState(false);
  const [paymentInfo, setPaymentInfo] = useState<any>(null);

  useEffect(() => {
    verifyPayment();
  }, []);

  const verifyPayment = async () => {
    const sessionId = searchParams.get('session_id');
    
    if (!sessionId) {
      toast({
        title: '参数错误',
        description: '缺少支付会话ID',
        variant: 'destructive',
      });
      setVerifying(false);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('verify_stripe_payment', {
        body: { sessionId },
      });

      if (error) throw error;

      if (data?.data?.verified) {
        setVerified(true);
        setPaymentInfo(data.data);
        toast({
          title: '支付成功',
          description: '点数已充值到您的账户',
        });
      } else {
        setVerified(false);
        toast({
          title: '支付未完成',
          description: '请稍后重试或联系客服',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      console.error('验证支付失败:', error);
      toast({
        title: '验证失败',
        description: error.message || '无法验证支付状态',
        variant: 'destructive',
      });
      setVerified(false);
    } finally {
      setVerifying(false);
    }
  };

  if (verifying) {
    return (
      <div className="container mx-auto p-6 max-w-2xl">
        <Card className="text-center p-12">
          <Loader2 className="h-16 w-16 mx-auto text-primary animate-spin mb-4" />
          <h2 className="text-2xl font-bold mb-2">正在验证支付...</h2>
          <p className="text-muted-foreground">请稍候，不要关闭此页面</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <Card className="text-center p-12">
        {verified ? (
          <>
            <CheckCircle className="h-16 w-16 mx-auto text-green-500 mb-4" />
            <h2 className="text-2xl font-bold mb-2">支付成功！</h2>
            <p className="text-muted-foreground mb-6">
              您的点数已成功充值到账户
            </p>
            {paymentInfo && (
              <div className="bg-muted p-4 rounded-lg mb-6 text-left">
                <p className="text-sm">
                  <span className="text-muted-foreground">订单号：</span>
                  <span className="font-mono">{paymentInfo.sessionId}</span>
                </p>
                <p className="text-sm mt-2">
                  <span className="text-muted-foreground">金额：</span>
                  <span className="font-bold">
                    {paymentInfo.currency?.toUpperCase()} {(paymentInfo.amount / 100).toFixed(2)}
                  </span>
                </p>
              </div>
            )}
            <div className="flex gap-4 justify-center">
              <Button onClick={() => navigate('/settings')}>
                查看账户
              </Button>
              <Button variant="outline" onClick={() => navigate('/')}>
                返回首页
              </Button>
            </div>
          </>
        ) : (
          <>
            <XCircle className="h-16 w-16 mx-auto text-destructive mb-4" />
            <h2 className="text-2xl font-bold mb-2">支付未完成</h2>
            <p className="text-muted-foreground mb-6">
              支付可能已取消或未成功，请重试
            </p>
            <div className="flex gap-4 justify-center">
              <Button onClick={() => navigate('/settings')}>
                重新购买
              </Button>
              <Button variant="outline" onClick={() => navigate('/')}>
                返回首页
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
