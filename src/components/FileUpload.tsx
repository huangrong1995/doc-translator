import React, { useCallback, useState, useRef } from 'react';
import { Upload, FileText, AlertCircle, X, CheckCircle2, FileType } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';

export interface FileWithStatus {
  file: File;
  id: string;
  status: 'idle' | 'uploading' | 'processing' | 'translating' | 'completed' | 'error';
  progress: number;
  error?: string;
  targetLang?: string;
  resultBlob?: Blob; 
}

interface FileUploadProps {
  onFilesAdded: (files: File[]) => void;
  isProcessing: boolean;
}

export function FileUpload({ onFilesAdded, isProcessing }: FileUploadProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isProcessing) setIsDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  };

  const processFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    const files = Array.from(fileList);
    const validFiles: File[] = [];
    const allowedExts = ['.pdf', '.docx', '.md', '.txt'];
    const maxSize = 10 * 1024 * 1024;

    files.forEach(file => {
      const isAllowed = allowedExts.some(e => file.name.toLowerCase().endsWith(e));
      
      if (!isAllowed) {
        toast.error(`${file.name}: 不支持的文件格式`);
        return;
      }
      if (file.size > maxSize) {
        toast.error(`${file.name}: 文件过大 (最大 10MB)`);
        return;
      }
      validFiles.push(file);
    });

    if (validFiles.length > 0) {
      onFilesAdded(validFiles);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (isProcessing) {
      toast.warning("请等待当前任务完成");
      return;
    }
    processFiles(e.dataTransfer.files);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isProcessing) return;
    processFiles(e.target.files);
    // reset input
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleClick = () => {
    if (!isProcessing && inputRef.current) {
        inputRef.current.click();
    }
  };

  return (
    <div
      onClick={handleClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "relative group cursor-pointer flex flex-col items-center justify-center w-full h-64 rounded-xl border-2 border-dashed transition-all duration-300 ease-out overflow-hidden bg-card",
        isDragActive 
          ? "border-primary bg-primary/5 scale-[1.01] shadow-lg" 
          : "border-border hover:border-primary/50 hover:bg-muted/30",
        isProcessing && "opacity-50 cursor-not-allowed"
      )}
    >
      <input 
        ref={inputRef}
        type="file" 
        multiple 
        className="hidden" 
        accept=".pdf,.docx,.md,.txt"
        onChange={handleChange}
        disabled={isProcessing}
      />
      
      <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] dark:bg-grid-slate-700/25 pointer-events-none" />

      <div className="z-10 flex flex-col items-center space-y-4 text-center p-6">
        <div className={cn(
          "p-4 rounded-full bg-primary/10 transition-transform duration-300",
          isDragActive ? "scale-110" : "group-hover:scale-105"
        )}>
          <Upload className={cn(
            "w-8 h-8 text-primary transition-colors",
            isDragActive ? "text-primary" : "text-primary/70"
          )} />
        </div>
        
        <div className="space-y-1">
          <p className="text-lg font-semibold text-foreground">
            {isDragActive ? "释放文件以添加" : "拖拽文件到这里，或点击上传"}
          </p>
          <p className="text-sm text-muted-foreground">
            支持 PDF, DOCX, Markdown (最大 10MB)
          </p>
        </div>
      </div>
    </div>
  );
}

interface FileListProps {
  files: FileWithStatus[];
  onRemove: (id: string) => void;
  onProcess: () => void;
}

export function FileList({ files, onRemove, onProcess }: FileListProps) {
  if (files.length === 0) return null;

  const allCompleted = files.every(f => f.status === 'completed');
  const hasProcessing = files.some(f => ['uploading', 'processing', 'translating'].includes(f.status));

  return (
    <div className="w-full space-y-4 mt-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">待处理文件 ({files.length})</h3>
        {files.length > 0 && !hasProcessing && !allCompleted && (
          <Button onClick={onProcess} size="sm" className="ml-auto">
            开始翻译
          </Button>
        )}
      </div>

      <AnimatePresence mode="popLayout">
        {files.map((item) => (
          <motion.div
            key={item.id}
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="group relative flex items-center gap-4 p-4 rounded-lg border bg-card shadow-sm hover:shadow-md transition-all"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <FileType className="h-5 w-5 text-primary" />
            </div>
            
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-medium truncate pr-4">{item.file.name}</p>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {(item.file.size / 1024).toFixed(1)} KB
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <Progress value={item.progress} className="h-1.5 flex-1" />
                <span className="text-xs w-16 text-right font-medium text-muted-foreground">
                  {getStatusText(item.status)}
                </span>
              </div>
            </div>

            {item.status === 'error' && (
               <div className="text-destructive">
                 <AlertCircle className="w-5 h-5" />
               </div>
            )}

            {item.status === 'completed' && (
               <div className="text-green-500">
                 <CheckCircle2 className="w-5 h-5" />
               </div>
            )}

            {item.status === 'idle' && (
              <Button
                variant="ghost"
                size="icon"
                className="opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => { e.stopPropagation(); onRemove(item.id); }}
              >
                <X className="w-4 h-4 text-muted-foreground hover:text-destructive" />
              </Button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function getStatusText(status: FileWithStatus['status']) {
  switch (status) {
    case 'idle': return '等待中';
    case 'uploading': return '读取中...';
    case 'processing': return '解析中...';
    case 'translating': return '翻译中...';
    case 'completed': return '完成';
    case 'error': return '失败';
    default: return '';
  }
}
