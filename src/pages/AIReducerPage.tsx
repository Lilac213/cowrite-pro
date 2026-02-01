import { useState } from 'react';
import { callLLMGenerate } from '@/db/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { FileDown } from 'lucide-react';

export default function AIReducerPage() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [processing, setProcessing] = useState(false);
  const { toast } = useToast();

  const handleReduce = async () => {
    if (!input.trim()) {
      toast({
        title: '请输入文本',
        variant: 'destructive',
      });
      return;
    }

    setProcessing(true);
    try {
      const prompt = `请对以下文章进行降 AI 率处理：

${input}

要求：
1. 删除套话：在当今时代、综上所述、值得注意的是
2. 拆解 AI 句式：不是...而是...连续出现
3. 替换书面词汇：显著提升 → 具体数字，充分利用 → 用好
4. 改成口语化：进行操作 → 直接用动词
5. 加入真实细节：抽象表达 → 具体数字/案例
6. 加入个人态度：中立客观 → 明确观点

请返回处理后的文章。`;

      const result = await callLLMGenerate(prompt);
      setOutput(result);
      toast({
        title: '处理成功',
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
        <Button onClick={handleReduce} disabled={processing} size="lg">
          {processing ? '处理中...' : '降 AI 率'}
        </Button>
      </div>
    </div>
  );
}
