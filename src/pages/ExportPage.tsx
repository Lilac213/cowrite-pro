import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { getProject, getLatestDraft, getTemplates, updateProject, markProjectAsCompleted } from '@/db/api';
import type { Project, Draft, Template } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import WorkflowProgress from '@/components/workflow/WorkflowProgress';

export default function ExportPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('academic');
  const [filename, setFilename] = useState('');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // 推荐模板
  const recommendedTemplates = [
    {
      id: 'academic',
      name: '学术论文',
      description: '适合学术论文，使用 Times New Roman 字体，双倍行距',
      styles: {
        fontFamily: 'Times New Roman, serif',
        lineHeight: '2',
        fontSize: '12pt',
      },
    },
    {
      id: 'simple',
      name: '简洁风格',
      description: '简洁清晰，使用 Arial 字体，适合一般文档',
      styles: {
        fontFamily: 'Arial, sans-serif',
        lineHeight: '1.6',
        fontSize: '11pt',
      },
    },
    {
      id: 'modern',
      name: '现代风格',
      description: '现代设计，使用 Helvetica 字体，适合演示文稿',
      styles: {
        fontFamily: 'Helvetica Neue, sans-serif',
        lineHeight: '1.5',
        fontSize: '11pt',
      },
    },
  ];

  useEffect(() => {
    loadData();
  }, [projectId, user]);

  const loadData = async () => {
    if (!projectId || !user) return;
    try {
      const projectData = await getProject(projectId);
      const draftData = await getLatestDraft(projectId);
      const templatesData = await getTemplates(user.id);
      
      if (!projectData) {
        toast({
          title: '项目不存在',
          description: '无法找到该项目',
          variant: 'destructive',
        });
        navigate('/');
        return;
      }
      
      setProject(projectData);
      setDraft(draftData);
      setTemplates(templatesData);
      setFilename(projectData.title || '文章');
    } catch (error) {
      toast({
        title: '加载失败',
        description: '无法加载项目信息',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // 将内容转换为 Markdown 格式
  const convertToMarkdown = (content: string): string => {
    // 如果内容已经是 Markdown 格式，直接返回
    if (content.includes('# ') || content.includes('## ')) {
      return content;
    }
    
    // 否则，进行简单的转换
    let markdown = `# ${project?.title || '文章'}\n\n`;
    markdown += content;
    return markdown;
  };

  // 将 Markdown 转换为 HTML
  const markdownToHtml = (markdown: string, templateStyles: any): string => {
    const lines = markdown.split('\n');
    let html = '';
    
    for (const line of lines) {
      if (line.startsWith('# ')) {
        html += `<h1>${line.substring(2)}</h1>\n`;
      } else if (line.startsWith('## ')) {
        html += `<h2>${line.substring(3)}</h2>\n`;
      } else if (line.startsWith('### ')) {
        html += `<h3>${line.substring(4)}</h3>\n`;
      } else if (line.trim()) {
        html += `<p>${line}</p>\n`;
      } else {
        html += '<br>\n';
      }
    }
    
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${project?.title || '文章'}</title>
  <style>
    @page { size: A4; margin: 2cm; }
    body {
      font-family: ${templateStyles.fontFamily};
      line-height: ${templateStyles.lineHeight};
      font-size: ${templateStyles.fontSize};
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }
    h1 {
      font-size: 24pt;
      font-weight: bold;
      margin-top: 20pt;
      text-align: center;
    }
    h2 {
      font-size: 18pt;
      font-weight: bold;
      margin-top: 16pt;
    }
    h3 {
      font-size: 16pt;
      font-weight: bold;
      margin-top: 14pt;
    }
    p {
      margin: 10pt 0;
      text-align: justify;
      text-indent: 2em;
    }
  </style>
</head>
<body>
${html}
</body>
</html>`;
  };

  const handleExport = async () => {
    if (!draft || !draft.content) {
      toast({
        title: '无内容',
        description: '没有可导出的文章内容',
        variant: 'destructive',
      });
      return;
    }

    if (!filename.trim()) {
      toast({
        title: '请输入文件名',
        variant: 'destructive',
      });
      return;
    }

    setExporting(true);
    try {
      // 转换为 Markdown
      const markdown = convertToMarkdown(draft.content);
      
      // 导出 Markdown 文件
      const blob = new Blob([markdown], { type: 'text/markdown' });
      const finalFilename = filename + '.md';
      
      // 下载文件
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = finalFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: '导出成功',
        description: `文章已导出为 Markdown 格式`,
      });

      // 更新项目状态为已完成
      await updateProject(projectId!, { status: 'completed' });
      
      // 标记项目为已完稿（锁定需求文档）
      await markProjectAsCompleted(projectId!);
      
      toast({
        title: '项目已完稿',
        description: '需求文档已锁定，无法再修改',
      });
      
      // 延迟后返回项目页面
      setTimeout(() => {
        navigate(`/project/${projectId}`);
      }, 1500);
    } catch (error: any) {
      toast({
        title: '导出失败',
        description: error.message || '无法导出文章',
        variant: 'destructive',
      });
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => navigate(`/project/${projectId}`)}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          返回项目
        </Button>
        <h1 className="text-3xl font-bold">排版导出</h1>
        <p className="text-muted-foreground mt-2">选择模板和格式，导出您的文章</p>
      </div>

      {/* 进度条 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>项目进度</CardTitle>
          <CardDescription>当前阶段：排版导出</CardDescription>
        </CardHeader>
        <CardContent>
          <WorkflowProgress currentStage="layout_export" />
        </CardContent>
      </Card>

      {/* 文件名和模板选择 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* 文件名输入 */}
        <Card>
          <CardHeader>
            <CardTitle>文件名</CardTitle>
            <CardDescription>输入导出文件的名称</CardDescription>
          </CardHeader>
          <CardContent>
            <Input
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              placeholder="请输入文件名"
            />
          </CardContent>
        </Card>

        {/* 模板选择 */}
        <Card>
          <CardHeader>
            <CardTitle>选择模板</CardTitle>
            <CardDescription>选择文章的排版样式</CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
              <SelectTrigger>
                <SelectValue placeholder="选择模板" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="academic">学术论文</SelectItem>
                <SelectItem value="simple">简洁风格</SelectItem>
                <SelectItem value="modern">现代风格</SelectItem>
                {templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-2">
              导出格式：Markdown (.md)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 预览和导出 */}
      <Card>
        <CardHeader>
          <CardTitle>文章预览</CardTitle>
          <CardDescription>
            {filename || '未命名'} · Markdown
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-muted p-6 rounded-lg max-h-[400px] overflow-y-auto mb-4">
            <div className="whitespace-pre-wrap text-sm">
              {draft?.content || '暂无内容'}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => navigate(`/project/${projectId}`)}>
              取消
            </Button>
            <Button onClick={handleExport} disabled={exporting || !draft?.content || !filename.trim()}>
              {exporting ? (
                <>导出中...</>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  导出文章
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
