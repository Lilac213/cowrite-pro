import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lightbulb, Check, X } from 'lucide-react';

export interface SuggestionCardProps {
  id: string;
  type: 'logic' | 'style' | 'content';
  title: string;
  description: string;
  suggestion: string;
  onAccept?: () => void;
  onReject?: () => void;
  className?: string;
}

export function SuggestionCard({
  type,
  title,
  description,
  suggestion,
  onAccept,
  onReject,
  className,
}: SuggestionCardProps) {
  const typeConfig = {
    logic: {
      icon: Lightbulb,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
    },
    style: {
      icon: Lightbulb,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
    },
    content: {
      icon: Lightbulb,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200',
    },
  };

  const config = typeConfig[type];
  const Icon = config.icon;

  return (
    <Card className={`${config.borderColor} ${className || ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${config.color}`} />
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="text-sm text-muted-foreground mb-1">{description}</p>
          <div className={`p-3 rounded-md ${config.bgColor} border ${config.borderColor}`}>
            <p className="text-sm">{suggestion}</p>
          </div>
        </div>
        
        {(onAccept || onReject) && (
          <div className="flex gap-2">
            {onAccept && (
              <Button
                size="sm"
                variant="outline"
                onClick={onAccept}
                className="flex-1"
              >
                <Check className="h-3 w-3 mr-1" />
                接受
              </Button>
            )}
            {onReject && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onReject}
                className="flex-1"
              >
                <X className="h-3 w-3 mr-1" />
                忽略
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default SuggestionCard;