import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/db/supabase';
import { Search, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';

export default function SearchDebugPage() {
  const [requirementsDoc, setRequirementsDoc] = useState(`{
  "主题": "AI Agent应用的商业化路径与目标用户定位方法论",
  "关键要点": ["商业化策略", "用户定位", "市场分析"],
  "核心观点": ["AI Agent的商业价值", "目标用户画像"],
  "目标读者": "企业决策者",
  "写作风格": "专业分析",
  "预期长度": "中等"
}`);
  const [searching, setSearching] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  const handleSearch = async () => {
    setSearching(true);
    setLogs([]);
    setResult(null);
    setError(null);

    try {
      addLog('🚀 开始搜索流程');
      
      // 解析需求文档
      let parsedDoc;
      try {
        parsedDoc = JSON.parse(requirementsDoc);
        addLog('✅ 需求文档解析成功');
        addLog(`📋 主题: ${parsedDoc.主题}`);
      } catch (e) {
        throw new Error('需求文档 JSON 格式错误');
      }

      // 获取当前用户
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('未登录');
      }
      addLog(`👤 用户 ID: ${user.id}`);

      // 调用 Edge Function
      addLog('📡 调用 research-retrieval-agent Edge Function...');
      const startTime = Date.now();

      const { data, error: funcError } = await supabase.functions.invoke('research-retrieval-agent', {
        body: {
          requirementsDoc: JSON.stringify(parsedDoc),
          userId: user.id,
        },
      });

      const duration = Date.now() - startTime;
      addLog(`⏱️ 请求耗时: ${duration}ms`);

      if (funcError) {
        addLog(`❌ Edge Function 错误: ${funcError.message}`);
        throw funcError;
      }

      if (!data) {
        addLog('❌ Edge Function 返回数据为空');
        throw new Error('Edge Function 返回数据为空');
      }

      addLog('✅ Edge Function 调用成功');
      
      // 显示结果统计
      if (data.data) {
        const stats = {
          academic: data.data.academic_sources?.length || 0,
          news: data.data.news_sources?.length || 0,
          web: data.data.web_sources?.length || 0,
          user_library: data.data.user_library_sources?.length || 0,
        };
        
        addLog(`📊 搜索结果统计:`);
        addLog(`   - 学术来源: ${stats.academic} 条`);
        addLog(`   - 新闻来源: ${stats.news} 条`);
        addLog(`   - 网络来源: ${stats.web} 条`);
        addLog(`   - 用户库来源: ${stats.user_library} 条`);
        addLog(`   - 总计: ${stats.academic + stats.news + stats.web + stats.user_library} 条`);

        if (data.data.search_summary) {
          addLog(`🎯 搜索主题: ${data.data.search_summary.interpreted_topic || 'N/A'}`);
          addLog(`📌 关键维度: ${data.data.search_summary.key_dimensions?.join(', ') || 'N/A'}`);
        }
      }

      setResult(data);
      addLog('✅ 搜索流程完成');

    } catch (err: any) {
      const errorMsg = err.message || err.toString();
      addLog(`❌ 搜索失败: ${errorMsg}`);
      setError(errorMsg);
      console.error('搜索错误:', err);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">🔍 搜索功能调试工具</h1>
          <p className="text-muted-foreground mt-2">
            测试和调试 Research Retrieval Agent 搜索功能
          </p>
        </div>
      </div>

      <Separator />

      {/* 输入区域 */}
      <Card>
        <CardHeader>
          <CardTitle>需求文档</CardTitle>
          <CardDescription>
            输入 JSON 格式的需求文档，用于生成搜索计划
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={requirementsDoc}
            onChange={(e) => setRequirementsDoc(e.target.value)}
            rows={12}
            className="font-mono text-sm"
            placeholder="输入 JSON 格式的需求文档..."
          />
          <Button 
            onClick={handleSearch} 
            disabled={searching}
            className="w-full"
            size="lg"
          >
            {searching ? (
              <>
                <div className="animate-spin mr-2 h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                搜索中...
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                开始搜索
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* 日志区域 */}
      <Card>
        <CardHeader>
          <CardTitle>执行日志</CardTitle>
          <CardDescription>
            实时显示搜索流程的详细日志
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-muted rounded-lg p-4 font-mono text-sm space-y-1 max-h-96 overflow-y-auto">
            {logs.length === 0 ? (
              <div className="text-muted-foreground text-center py-8">
                点击"开始搜索"按钮查看日志
              </div>
            ) : (
              logs.map((log, index) => (
                <div key={index} className="text-xs">
                  {log}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* 错误信息 */}
      {error && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center text-destructive">
              <XCircle className="mr-2 h-5 w-5" />
              错误信息
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-destructive/10 rounded-lg p-4 text-sm">
              {error}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 搜索结果 */}
      {result && (
        <div className="space-y-4">
          {/* 搜索摘要 */}
          {result.data?.search_summary && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <CheckCircle2 className="mr-2 h-5 w-5 text-green-500" />
                  搜索摘要
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <span className="font-medium">理解的主题：</span>
                  <span className="ml-2">{result.data.search_summary.interpreted_topic}</span>
                </div>
                <div>
                  <span className="font-medium">关键维度：</span>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {result.data.search_summary.key_dimensions?.map((dim: string, idx: number) => (
                      <Badge key={idx} variant="secondary">{dim}</Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 学术来源 */}
          {result.data?.academic_sources && result.data.academic_sources.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>
                  📚 学术来源 ({result.data.academic_sources.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {result.data.academic_sources.map((source: any, idx: number) => (
                    <div key={idx} className="border rounded-lg p-4 space-y-2">
                      <div className="font-medium">{source.title}</div>
                      <div className="text-sm text-muted-foreground">
                        作者: {source.authors || 'N/A'} | 
                        年份: {source.publication_year || 'N/A'} | 
                        引用: {source.citation_count || 0}
                      </div>
                      <div className="text-sm">{source.abstract}</div>
                      {source.url && (
                        <a 
                          href={source.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline"
                        >
                          {source.url}
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 新闻来源 */}
          {result.data?.news_sources && result.data.news_sources.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>
                  📰 新闻来源 ({result.data.news_sources.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {result.data.news_sources.map((source: any, idx: number) => (
                    <div key={idx} className="border rounded-lg p-4 space-y-2">
                      <div className="font-medium">{source.title}</div>
                      <div className="text-sm text-muted-foreground">
                        来源: {source.source || 'N/A'} | 
                        发布时间: {source.published_at || 'N/A'}
                      </div>
                      <div className="text-sm">{source.summary}</div>
                      {source.url && (
                        <a 
                          href={source.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline"
                        >
                          {source.url}
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 网络来源 */}
          {result.data?.web_sources && result.data.web_sources.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>
                  🌐 网络来源 ({result.data.web_sources.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {result.data.web_sources.map((source: any, idx: number) => (
                    <div key={idx} className="border rounded-lg p-4 space-y-2">
                      <div className="font-medium">{source.title}</div>
                      <div className="text-sm text-muted-foreground">
                        网站: {source.site_name || 'N/A'}
                      </div>
                      <div className="text-sm">{source.snippet}</div>
                      {source.url && (
                        <a 
                          href={source.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline"
                        >
                          {source.url}
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 原始响应 */}
          <Card>
            <CardHeader>
              <CardTitle>🔧 原始响应数据</CardTitle>
              <CardDescription>
                完整的 Edge Function 返回数据（JSON 格式）
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="bg-muted rounded-lg p-4 text-xs overflow-x-auto max-h-96 overflow-y-auto">
                {JSON.stringify(result, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 提示信息 */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="flex items-center text-blue-700">
            <AlertCircle className="mr-2 h-5 w-5" />
            调试提示
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-blue-700 space-y-2">
          <p>• 查看浏览器控制台（F12）获取更多前端日志</p>
          <p>• 查看 Supabase Dashboard → Edge Functions → research-retrieval-agent → Logs 获取后端日志</p>
          <p>• 确保 QIANWEN_API_KEY 和 INTEGRATIONS_API_KEY 已正确配置</p>
          <p>• 如果搜索结果为空，检查 Edge Function 日志中的详细错误信息</p>
        </CardContent>
      </Card>
    </div>
  );
}
