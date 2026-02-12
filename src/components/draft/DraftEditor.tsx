import { useEffect, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import CitationMarker from './CitationMarker';
import type { Citation } from '@/types';

interface DraftEditorProps {
  content: string;
  citations: Citation[];
  onContentChange: (content: string) => void;
  readonly?: boolean;
  streaming?: boolean;
}

export default function DraftEditor({
  content,
  citations,
  onContentChange,
  readonly = false,
  streaming = false,
}: DraftEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [activeParagraphId, setActiveParagraphId] = useState<string | undefined>();

  // Render content with citation markers
  const renderContentWithCitations = () => {
    if (!content) return null;

    // Sort citations by position
    const sortedCitations = [...citations].sort((a, b) => a.position - b.position);

    // Split content and insert citation markers
    const parts: (string | React.ReactElement)[] = [];
    let lastPosition = 0;

    sortedCitations.forEach((citation, index) => {
      // Add text before citation
      if (citation.position > lastPosition) {
        parts.push(content.substring(lastPosition, citation.position));
      }

      // Add citation marker
      parts.push(
        <CitationMarker
          key={citation.id}
          citation={citation}
          index={index + 1}
        />
      );

      lastPosition = citation.position;
    });

    // Add remaining text
    if (lastPosition < content.length) {
      parts.push(content.substring(lastPosition));
    }

    return parts;
  };

  // Handle content editing
  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    const newContent = e.currentTarget.textContent || '';
    onContentChange(newContent);
  };

  // Auto-scroll to bottom when streaming
  useEffect(() => {
    if (streaming && editorRef.current) {
      editorRef.current.scrollTop = editorRef.current.scrollHeight;
    }
  }, [content, streaming]);

  if (readonly || citations.length > 0) {
    // Render with citation markers (read-only or with citations)
    return (
      <Card className="h-full">
        <CardContent className="p-0">
          <ScrollArea className="h-full">
            <div className="p-6 prose prose-sm max-w-none">
              {renderContentWithCitations()}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    );
  }

  // Editable mode without citations
  return (
    <Card className="h-full">
      <CardContent className="p-0">
        <ScrollArea className="h-full">
          <div
            ref={editorRef}
            contentEditable={!readonly}
            onInput={handleInput}
            className="p-6 prose prose-sm max-w-none focus:outline-none min-h-full"
            suppressContentEditableWarning
          >
            {content}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
