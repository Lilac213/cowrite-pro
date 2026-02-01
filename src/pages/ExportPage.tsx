import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { getProject, getLatestDraft } from '@/db/api';
import type { Project, Draft } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ArrowLeft, Download, FileText, FileDown, FileCode } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type ExportFormat = 'pdf' | 'word' | 'markdown';
type ExportTemplate = 'academic' | 'simple' | 'modern';

export default function ExportPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [format, setFormat] = useState<ExportFormat>('pdf');
  const [template, setTemplate] = useState<ExportTemplate>('academic');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, [projectId, user]);

  const loadData = async () => {
    if (!projectId || !user) return;
    try {
      const projectData = await getProject(projectId);
      const draftData = await getLatestDraft(projectId);
      
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

  const handleExport = async () => {
    if (!draft || !draft.content) {
      toast({
        title: '无内容',
        description: '没有可导出的文章内容',
        variant: 'destructive',
      });
      return;
    }

    setExporting(true);
    try {
      let content = draft.content;
      let filename = `${project?.title || '文章'}_${new Date().toISOString().split('T')[0]}`;

      if (format === 'pdf') {
        // PDF 格式 (使用浏览器打印功能)
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${project?.title || '文章'}</title>
  <style>
    @page { size: A4; margin: 2cm; }
    body { font-family: 'Times New Roman', serif; line-height: 1.6; font-size: 12pt; }
    h1 { font-size: 18pt; font-weight: bold; margin-top: 20pt; text-align: center; }
    h2 { font-size: 16pt; font-weight: bold; margin-top: 16pt; }
    h3 { font-size: 14pt; font-weight: bold; margin-top: 14pt; }
    p { margin: 10pt 0; text-align: justify; text-indent: 2em; }
    .template-academic { }
    .template-simple { font-family: Arial, sans-serif; }
    .template-modern { font-family: 'Helvetica Neue', sans-serif; color: #333; }
  </style>
</head>
<body class="template-${template}">
  <h1>${project?.title || '文章'}</h1>
  ${content.split('\n').map(line => {
    if (line.startsWith('# ')) return `<h1>${line.substring(2)}</h1>`;
    if (line.startsWith('## ')) return `<h2>${line.substring(3)}</h2>`;
    if (line.startsWith('### ')) return `<h3>${line.substring(4)}</h3>`;
    if (line.trim()) return `<p>${line}</p>`;
    return '<br>';
  }).join('\n')}
</body>
</html>`);
          printWindow.document.close();
          printWindow.print();
          setExporting(false);
          toast({
            title: '导出成功',
            description: '请在打印对话框中选择"另存为 PDF"',
          });
          return;
        }
      }

      let mimeType = '';
      let blob: Blob;

      if (format === 'markdown') {
        // Markdown 格式
        mimeType = 'text/markdown';
        filename += '.md';
        blob = new Blob([content], { type: mimeType });
      } else {
        // Word 格式 (简单的 HTML 转换)
        mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        filename += '.docx';
        
        // 将 Markdown 转换为简单的 HTML
        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${project?.title || '文章'}</title>
  <style>
    body { font-family: 'Times New Roman', serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; }
    h1 { font-size: 24px; font-weight: bold; margin-top: 20px; }
    h2 { font-size: 20px; font-weight: bold; margin-top: 16px; }
    h3 { font-size: 18px; font-weight: bold; margin-top: 14px; }
    p { margin: 10px 0; text-align: justify; }
  </style>
</head>
<body>
  ${content.replace(/\n/g, '<br>')}
</body>
</html>`;
        blob = new Blob([htmlContent], { type: 'text/html' });
        filename = filename.replace('.docx', '.html'); // 暂时导出为 HTML
      }

      // 下载文件
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: '导出成功',
        description: `文章已导出为 ${format.toUpperCase()} 格式`,
      });
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
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => navigate(`/project/${projectId}`)}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          返回项目
        </Button>
        <h1 className="text-3xl font-bold">导出文章</h1>
        <p className="text-muted-foreground mt-2">选择模板和格式，导出您的文章</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 模板选择 */}
        <Card>
          <CardHeader>
            <CardTitle>选择模板</CardTitle>
            <CardDescription>选择文章的排版样式</CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup value={template} onValueChange={(value) => setTemplate(value as ExportTemplate)}>
              <div className="space-y-4">
                <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-accent cursor-pointer">
                  <RadioGroupItem value="academic" id="academic" />
                  <Label htmlFor="academic" className="cursor-pointer flex-1">
                    <div className="font-medium">学术论文</div>
                    <div className="text-sm text-muted-foreground">
                      适合学术论文，使用 Times New Roman 字体，双倍行距
                    </div>
                  </Label>
                </div>
                <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-accent cursor-pointer">
                  <RadioGroupItem value="simple" id="simple" />
                  <Label htmlFor="simple" className="cursor-pointer flex-1">
                    <div className="font-medium">简洁风格</div>
                    <div className="text-sm text-muted-foreground">
                      简洁清晰，使用 Arial 字体，适合一般文档
                    </div>
                  </Label>
                </div>
                <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-accent cursor-pointer">
                  <RadioGroupItem value="modern" id="modern" />
                  <Label htmlFor="modern" className="cursor-pointer flex-1">
                    <div className="font-medium">现代风格</div>
                    <div className="text-sm text-muted-foreground">
                      现代设计，使用 Helvetica 字体，适合演示文稿
                    </div>
                  </Label>
                </div>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        {/* 格式选择 */}
        <Card>
          <CardHeader>
            <CardTitle>选择格式</CardTitle>
            <CardDescription>选择文章的导出格式</CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup value={format} onValueChange={(value) => setFormat(value as ExportFormat)}>
              <div className="space-y-4">
                <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-accent cursor-pointer">
                  <RadioGroupItem value="pdf" id="pdf" />
                  <Label htmlFor="pdf" className="cursor-pointer flex-1">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      <div className="font-medium">PDF</div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      便于分享和打印，保持格式不变
                    </div>
                  </Label>
                </div>
                <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-accent cursor-pointer">
                  <RadioGroupItem value="word" id="word" />
                  <Label htmlFor="word" className="cursor-pointer flex-1">
                    <div className="flex items-center gap-2">
                      <FileDown className="h-4 w-4" />
                      <div className="font-medium">Word (HTML)</div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      可编辑格式，支持进一步修改
                    </div>
                  </Label>
                </div>
                <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-accent cursor-pointer">
                  <RadioGroupItem value="markdown" id="markdown" />
                  <Label htmlFor="markdown" className="cursor-pointer flex-1">
                    <div className="flex items-center gap-2">
                      <FileCode className="h-4 w-4" />
                      <div className="font-medium">Markdown</div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      纯文本格式，适合版本控制和在线发布
                    </div>
                  </Label>
                </div>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>
      </div>

      {/* 预览和导出 */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>文章预览</CardTitle>
          <CardDescription>
            {project?.title || '无标题'} · {format.toUpperCase()} · {template === 'academic' ? '学术论文' : template === 'simple' ? '简洁风格' : '现代风格'}
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
            <Button onClick={handleExport} disabled={exporting || !draft?.content}>
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
