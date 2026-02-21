import { useState } from 'react';
import { Send, Sparkles, User, Bot, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';

interface Message {
  id: string;
  role: 'user' | 'ai';
  content: string;
  timestamp: number;
  isStreaming?: boolean;
}

interface CoachingChatProps {
  paragraphId: string;
  paragraphContent: string;
  onUpdateParagraph: (newContent: string) => void;
}

import { refineParagraph } from '@/api/draft.api';

export default function CoachingChat({
  paragraphId,
  paragraphContent,
  onUpdateParagraph
}: CoachingChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      // Call real API
      const result: any = await refineParagraph(paragraphContent, userMsg.content);
      
      if (result.success) {
        const aiResponse = `${result.explanation}\n\n建议修改:\n${result.refined_content}`;
        
        const aiMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: 'ai',
          content: aiResponse,
          timestamp: Date.now()
        };

        setMessages(prev => [...prev, aiMsg]);
        setSuggestion(result.refined_content);
      } else {
        throw new Error(result.error || '润色失败');
      }

    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'ai',
        content: '抱歉，处理您的请求时出现错误。',
        timestamp: Date.now()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApply = () => {
    if (suggestion) {
      onUpdateParagraph(suggestion);
      setSuggestion(null);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'ai',
        content: '✅ 已更新段落内容。',
        timestamp: Date.now()
      }]);
    }
  };

  const handleDiscard = () => {
    setSuggestion(null);
  };

  return (
    <div className="flex flex-col h-[400px] border rounded-lg bg-white shadow-sm">
      <div className="p-3 border-b bg-slate-50 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">AI 协作助手</span>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground text-xs py-8">
              有什么我可以帮您的吗？<br />
              您可以让我润色文字、扩充观点或调整语气。
            </div>
          )}
          
          {messages.map(msg => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback className={msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-green-100 text-green-700'}>
                  {msg.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                </AvatarFallback>
              </Avatar>
              <div
                className={`rounded-lg p-3 text-sm max-w-[85%] ${
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-slate-100 text-slate-800'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {suggestion && (
            <Card className="border-green-200 bg-green-50 animate-in fade-in slide-in-from-bottom-2">
              <CardContent className="p-3 space-y-2">
                <div className="text-xs font-medium text-green-700 flex items-center justify-between">
                  <span>建议修改预览:</span>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-green-700 hover:text-green-800 hover:bg-green-200" onClick={handleApply}>
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-red-700 hover:text-red-800 hover:bg-red-200" onClick={handleDiscard}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="text-sm bg-white p-2 rounded border border-green-100 text-slate-700">
                  {suggestion}
                </div>
                <Button size="sm" className="w-full bg-green-600 hover:bg-green-700 text-white h-8" onClick={handleApply}>
                  应用修改
                </Button>
              </CardContent>
            </Card>
          )}

          {isLoading && (
            <div className="flex gap-3">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-green-100 text-green-700">
                  <Bot className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <div className="bg-slate-100 rounded-lg p-3 flex items-center gap-1">
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="p-3 border-t bg-white">
        <div className="relative">
          <Textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="输入指令，例如：'把这段话改得更正式一点'..."
            className="pr-10 min-h-[80px] resize-none"
          />
          <Button
            size="icon"
            className="absolute bottom-2 right-2 h-8 w-8"
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
