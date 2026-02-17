import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getProfile } from '@/api';
import { checkAIReducerLimit, incrementAIReducerUsage } from '@/services/credit.service';
import { apiJson } from '@/api/http';

async function callLLMGenerate(prompt: string, context?: string, systemMessage?: string) {
  const data = await apiJson<{ result: { result: string } }>(
    '/api/llm/generate',
    {
      prompt,
      context,
      systemMessage,
      schema: { required: ['result'] }
    },
    true
  );
  return data.result.result;
}
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { FileDown, AlertCircle, ShoppingCart } from 'lucide-react';
import { DEFAULT_ENHANCE_PROMPT } from '@/constants/prompts';

export default function AIReducerPage() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [processing, setProcessing] = useState(false);
  const [canUse, setCanUse] = useState(true);
  const [usageInfo, setUsageInfo] = useState({ used: 0, limit: 0 });
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkUsageLimit();
  }, [user]);

  const checkUsageLimit = async () => {
    if (!user) return;
    try {
      const profile = await getProfile(user.id);
      if (profile) {
        setUsageInfo({
          used: profile.ai_reducer_used,
          limit: profile.unlimited_credits ? -1 : profile.available_credits,
        });
        setCanUse(profile.unlimited_credits || profile.available_credits > 0);
      }
    } catch (error) {
      console.error('检查使用限制失败:', error);
    }
  };

  const handleReduce = async () => {
    if (!input.trim()) {
      toast({
        title: '请输入文本',
        variant: 'destructive',
      });
      return;
    }

    if (!user) {
      toast({
        title: '请先登录',
        variant: 'destructive',
      });
      return;
    }

    // 检查使用限制
    if (!canUse) {
      toast({
        title: '次数不足',
        description: 'AI降重次数已用完，请购买点数',
        variant: 'destructive',
      });
      return;
    }

    setProcessing(true);
    try {
      // 增加使用次数
      await incrementAIReducerUsage(user.id);
      
      // 使用默认增强提示词进行降AI率处理
      const result = await callLLMGenerate(input, '', DEFAULT_ENHANCE_PROMPT);
      setOutput(result);
      
      // 更新使用信息
      await checkUsageLimit();
      
      toast({
        title: '处理成功',
        description: usageInfo.limit === -1 ? '管理员无限使用' : `剩余点数：${usageInfo.limit - 1}`,
      });
    } catch (error: any) {
      toast({
        title: '处理失败',
        description: error.message || '无法处理文本',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([output], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'reduced-article.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">AI 降重工具</h1>
        <p className="text-muted-foreground mt-2">降低文章的 AI 检测率</p>
      </div>

      {/* 使用情况提示 - 单行显示 */}
      <Alert className={`mb-6 ${!canUse ? 'border-destructive' : ''}`}>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>使用情况</AlertTitle>
        <AlertDescription className="flex items-center justify-between">
          <span>
            已使用 {usageInfo.used} 次
            {usageInfo.limit === -1 ? ' (无限)' : ` · 剩余点数 ${usageInfo.limit}`}
            {!canUse && ' - 点数已用完'}
          </span>
          {!canUse && (
            <Button 
              size="sm" 
              onClick={() => navigate('/settings')}
              variant="destructive"
            >
              <ShoppingCart className="h-3 w-3 mr-1" />
              购买点数
            </Button>
          )}
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>原文</CardTitle>
            <CardDescription>粘贴或输入需要处理的文章</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="在此输入文章内容..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={20}
              disabled={!canUse}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>处理后</CardTitle>
                <CardDescription>降 AI 率后的文章</CardDescription>
              </div>
              {output && (
                <Button variant="outline" size="sm" onClick={handleDownload}>
                  <FileDown className="h-4 w-4 mr-2" />
                  下载
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="处理结果将显示在这里..."
              value={output}
              onChange={(e) => setOutput(e.target.value)}
              rows={20}
            />
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-center mt-6">
        <Button 
          onClick={handleReduce} 
          disabled={processing || !canUse} 
          size="lg"
        >
          {processing ? '处理中...' : !canUse ? '次数不足' : '降 AI 率'}
        </Button>
      </div>
    </div>
  );
}
