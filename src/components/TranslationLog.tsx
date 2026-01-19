import React, { useRef, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { Terminal, Clock, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface LogEntry {
  id: string;
  timestamp: Date;
  fileName: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
  duration?: number;
}

interface TranslationLogProps {
  logs: LogEntry[];
}

export function TranslationLog({ logs }: TranslationLogProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when logs change using a dummy element
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  if (logs.length === 0) return null;

  return (
    <Card className="flex flex-col h-64 border-muted shadow-sm bg-card/50 backdrop-blur-sm overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/30">
        <Terminal className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-sm font-medium text-foreground">翻译日志</h3>
        <span className="text-xs text-muted-foreground ml-auto">{logs.length} 条记录</span>
      </div>
      
      <ScrollArea className="flex-1 p-4 font-mono text-xs">
        <div className="space-y-1.5">
          {logs.map((log) => (
            <div key={log.id} className="flex items-start gap-3 group">
              <span className="text-muted-foreground whitespace-nowrap opacity-60 w-16">
                {log.timestamp.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
              
              <div className="flex-1 break-all">
                <span className="inline-flex items-center gap-1.5 mr-2 text-muted-foreground font-semibold">
                   <FileText className="w-3 h-3" />
                   [{log.fileName}]
                </span>
                <span className={cn(
                    "mr-2",
                    log.type === 'error' && "text-destructive",
                    log.type === 'success' && "text-green-600",
                    log.type === 'warning' && "text-yellow-600",
                    log.type === 'info' && "text-foreground"
                )}>
                  {log.message}
                </span>
                
                {log.duration && (
                  <span className="inline-flex items-center gap-1 text-muted-foreground opacity-70">
                    <Clock className="w-3 h-3" />
                    {log.duration}ms
                  </span>
                )}
              </div>
            </div>
          ))}
          {/* Dummy element for auto-scroll */}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>
    </Card>
  );
}
