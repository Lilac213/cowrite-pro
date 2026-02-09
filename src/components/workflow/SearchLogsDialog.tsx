import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CheckCircle2, Circle, AlertCircle, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SearchLog {
  timestamp: string;
  stage: string;
  message: string;
  status: 'success' | 'running' | 'error';
  details?: string;
}

interface SearchLogsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectTitle: string;
  logs: string[];
  logType?: 'search' | 'synthesis'; // 新增：日志类型
}

export default function SearchLogsDialog({ 
  open, 
  onOpenChange, 
  projectTitle,
  logs,
  logType = 'search' // 默认为搜索日志
}: SearchLogsDialogProps) {
  // 解析日志并生成时间轴格式
  const parseLogsToTimeline = (): SearchLog[] => {
    const timeline: SearchLog[] = [];
    const now = new Date();
    
    // 根据日志类型定义不同的阶段标识
    const searchStagePatterns = [
      { pattern: /项目初始化|接收到的请求参数/, stage: '项目初始化', status: 'success' as const },
      { pattern: /需求文档解析|解析需求文档/, stage: '需求文档解析成功', status: 'success' as const },
      { pattern: /Google Scholar.*开始|学术搜索/, stage: '正在检索学术来源', status: 'running' as const },
      { pattern: /Google Scholar.*找到|学术.*完成/, stage: '已完成学术文献检索', status: 'success' as const },
      { pattern: /TheNews.*开始|新闻搜索/, stage: '正在检索新闻来源', status: 'running' as const },
      { pattern: /TheNews.*找到|新闻.*完成/, stage: '已完成新闻资讯检索', status: 'success' as const },
      { pattern: /Smart Search.*开始|网页搜索/, stage: '正在检索网页内容', status: 'running' as const },
      { pattern: /Smart Search.*找到|网页.*完成/, stage: '已完成网页内容检索', status: 'success' as const },
      { pattern: /提取关键内容|内容提取/, stage: '正在提取关键内容...', status: 'running' as const },
      { pattern: /保存到知识库|入库成功/, stage: '已完成资料入库', status: 'success' as const },
      { pattern: /错误|失败|Error/, stage: '搜索出现错误', status: 'error' as const },
    ];
    
    const synthesisStagePatterns = [
      { pattern: /开始资料整理/, stage: '开始资料整理', status: 'success' as const },
      { pattern: /正在获取选中的资料/, stage: '正在获取选中的资料', status: 'running' as const },
      { pattern: /已选择.*条资料/, stage: '资料选择完成', status: 'success' as const },
      { pattern: /正在保存资料到知识库/, stage: '正在保存资料到知识库', status: 'running' as const },
      { pattern: /资料保存完成/, stage: '资料保存完成', status: 'success' as const },
      { pattern: /启动 Research Synthesis Agent/, stage: '启动 Research Synthesis Agent', status: 'running' as const },
      { pattern: /正在分析资料并生成研究洞察/, stage: '正在分析资料并生成研究洞察', status: 'running' as const },
      { pattern: /Research Synthesis Agent 完成/, stage: 'Research Synthesis Agent 完成', status: 'success' as const },
      { pattern: /正在加载研究洞察和空白/, stage: '正在加载研究洞察和空白', status: 'running' as const },
      { pattern: /已生成.*条研究洞察/, stage: '研究洞察生成完成', status: 'success' as const },
      { pattern: /错误|失败|Error|❌/, stage: '资料整理出现错误', status: 'error' as const },
    ];
    
    const stagePatterns = logType === 'synthesis' ? synthesisStagePatterns : searchStagePatterns;

    logs.forEach((log, index) => {
      // 为每条日志生成时间戳（模拟递增）
      const timestamp = new Date(now.getTime() - (logs.length - index) * 2000);
      const timeStr = timestamp.toLocaleTimeString('zh-CN', { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
      });

      // 匹配阶段
      for (const { pattern, stage, status } of stagePatterns) {
        if (pattern.test(log)) {
          // 检查是否已存在相同阶段（避免重复）
          const existingIndex = timeline.findIndex(item => item.stage === stage);
          if (existingIndex === -1) {
            timeline.push({
              timestamp: timeStr,
              stage,
              message: log.substring(0, 200),
              status,
              details: log
            });
          } else {
            // 更新已存在的阶段信息
            timeline[existingIndex].message = log.substring(0, 200);
            timeline[existingIndex].details = log;
          }
          break;
        }
      }
    });

    // 如果没有解析到任何阶段，添加通用日志
    if (timeline.length === 0 && logs.length > 0) {
      logs.slice(0, 10).forEach((log, index) => {
        const timestamp = new Date(now.getTime() - (logs.length - index) * 2000);
        const timeStr = timestamp.toLocaleTimeString('zh-CN', { 
          hour: '2-digit', 
          minute: '2-digit', 
          second: '2-digit' 
        });
        timeline.push({
          timestamp: timeStr,
          stage: `步骤 ${index + 1}`,
          message: log.substring(0, 200),
          status: 'success',
          details: log
        });
      });
    }

    return timeline;
  };

  const timeline = parseLogsToTimeline();

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'running':
        return <Circle className="w-5 h-5 text-blue-500" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Circle className="w-5 h-5 text-gray-400" />;
    }
  };

  const handleDownload = () => {
    const content = logs.join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const logTypeName = logType === 'synthesis' ? '资料整理日志' : '研究日志';
    a.download = `${logTypeName}-${projectTitle}-${new Date().toLocaleDateString()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const dialogTitle = logType === 'synthesis' ? '资料整理日志' : '研究日志';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[95vw]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl">{dialogTitle} - {projectTitle}</DialogTitle>
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download className="w-4 h-4 mr-2" />
              下载完整日志
            </Button>
          </div>
        </DialogHeader>
        
        <ScrollArea className="max-h-[70vh] pr-4">
          <div className="space-y-6 py-4">
            {timeline.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>暂无日志记录</p>
              </div>
            ) : (
              timeline.map((log, index) => (
                <div key={index} className="flex gap-4">
                  {/* 时间轴图标 */}
                  <div className="flex flex-col items-center">
                    {getStatusIcon(log.status)}
                    {index < timeline.length - 1 && (
                      <div className="w-0.5 h-full min-h-[60px] bg-border mt-2" />
                    )}
                  </div>

                  {/* 日志内容 */}
                  <div className="flex-1 pb-6">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-muted-foreground">{log.timestamp}</span>
                      {log.status === 'running' && (
                        <span className="text-xs bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded">
                          RUNNING
                        </span>
                      )}
                    </div>
                    <h4 className="font-semibold text-base mb-2">{log.stage}</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {log.message}
                    </p>
                    {log.details && log.details !== log.message && (
                      <details className="mt-2">
                        <summary className="text-xs text-primary cursor-pointer hover:underline">
                          查看详细信息
                        </summary>
                        <pre className="text-xs bg-muted p-3 rounded mt-2 overflow-x-auto whitespace-pre-wrap">
                          {log.details}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
