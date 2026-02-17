import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Check, X, Edit3 } from 'lucide-react';

export interface EditableParagraphProps {
  id: string;
  content: string;
  onSave?: (content: string) => void;
  onCancel?: () => void;
  className?: string;
  readonly?: boolean;
  placeholder?: string;
}

export function EditableParagraph({
  id,
  content,
  onSave,
  onCancel,
  className,
  readonly = false,
  placeholder = '请输入内容...',
}: EditableParagraphProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setEditContent(content);
  }, [content]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      // 设置光标到末尾
      const length = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(length, length);
    }
  }, [isEditing]);

  const handleEdit = () => {
    if (readonly) return;
    setIsEditing(true);
  };

  const handleSave = () => {
    if (onSave) {
      onSave(editContent);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditContent(content);
    setIsEditing(false);
    if (onCancel) {
      onCancel();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  if (isEditing) {
    return (
      <div className={cn('space-y-3', className)}>
        <Textarea
          ref={textareaRef}
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="min-h-[100px] resize-none"
          rows={4}
        />
        <div className="flex gap-2">
          <Button size="sm" onClick={handleSave}>
            <Check className="h-3 w-3 mr-1" />
            保存
          </Button>
          <Button size="sm" variant="outline" onClick={handleCancel}>
            <X className="h-3 w-3 mr-1" />
            取消
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('group relative', className)}>
      <div
        className={cn(
          'prose prose-sm max-w-none',
          'p-4 rounded-lg border border-transparent',
          'transition-all duration-200',
          !readonly && 'hover:border-border hover:bg-muted/50 cursor-pointer'
        )}
        onClick={handleEdit}
      >
        <div
          dangerouslySetInnerHTML={{ __html: content || placeholder }}
          className="min-h-[1.5rem]"
        />
        {!readonly && (
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button size="icon" variant="ghost" className="h-6 w-6">
              <Edit3 className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default EditableParagraph;