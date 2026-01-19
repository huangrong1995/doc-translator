import { useState, useCallback, useEffect } from 'react';
import { FileUpload, FileList, type FileWithStatus } from '@/components/FileUpload';
import { TranslationLog, type LogEntry } from '@/components/TranslationLog';
import { AuthModal } from '@/components/AuthModal';
import { authService, type User } from '@/lib/auth-service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from 'sonner';
import { nanoid } from 'nanoid';
import { parseDocument } from '@/lib/document-parser';
import { translateDocx, translateMarkdown, translatePlainFile, translatePdfPages } from '@/lib/doc-processor';
import { saveAs } from 'file-saver';
import { Settings, Languages, Download, CheckCircle2, Sparkles, Key, Server, Bot, User as UserIcon, LogOut, Save } from 'lucide-react';
import { cn } from '@/lib/utils';

// Model Definitions
const MODELS = [
  { id: 'gpt-4o', name: 'GPT-4o (OpenAI)', baseUrl: 'https://api.openai.com/v1' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini (OpenAI)', baseUrl: 'https://api.openai.com/v1' },
  { id: 'deepseek-chat', name: 'DeepSeek V3 (DeepSeek)', baseUrl: 'https://api.deepseek.com' },
  { id: 'deepseek-reasoner', name: 'DeepSeek R1 (DeepSeek)', baseUrl: 'https://api.deepseek.com' },
  { id: 'custom', name: 'Custom Model (Compatible)', baseUrl: '' },
];

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [files, setFiles] = useState<FileWithStatus[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [apiKey, setApiKey] = useState('');
  const [targetLang, setTargetLang] = useState<'auto' | 'zh' | 'en'>('auto');
  const [model, setModel] = useState<string>('gpt-4o-mini');
  const [baseUrl, setBaseUrl] = useState<string>('https://api.openai.com/v1');
  const [customModelName, setCustomModelName] = useState('gpt-3.5-turbo');
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSettings, setShowSettings] = useState(true);

  // Helper to restore settings from user object
  const restoreUserSettings = (u: User) => {
    if (u.apiKey) setApiKey(u.apiKey);
    if (u.model) setModel(u.model);
    if (u.baseUrl) setBaseUrl(u.baseUrl);
    if (u.customModelName) setCustomModelName(u.customModelName);
  };

  // Initialize Auth
  useEffect(() => {
    authService.getCurrentUser().then(u => {
      if (u) {
        setUser(u);
        restoreUserSettings(u);
        toast.success(`欢迎回来，${u.name}`);
      }
    });
  }, []);

  // Save Settings helper
  const saveUserSettings = async () => {
    if (!user) return;
    try {
        const updatedUser = await authService.updateSettings({
            apiKey,
            model,
            baseUrl,
            customModelName
        });
        setUser(updatedUser); // Update local user state
        toast.success("设置已保存到您的账户");
    } catch (error) {
        toast.error("保存失败");
    }
  };

  const handleLogout = () => {
    authService.logout();
    setUser(null);
    setApiKey('');
    // Reset to defaults or keep? Let's reset for privacy on logout
    setModel('gpt-4o-mini');
    setBaseUrl('https://api.openai.com/v1');
    setCustomModelName('gpt-3.5-turbo');
    toast.success("已退出登录");
  };

  // Auto-update Base URL when model changes (unless custom)
  const handleModelChange = (newModel: string) => {
    setModel(newModel);
    const selected = MODELS.find(m => m.id === newModel);
    if (selected && selected.id !== 'custom') {
      setBaseUrl(selected.baseUrl);
    }
  };

  const handleFilesAdded = (newFiles: File[]) => {
    const newFileEntries: FileWithStatus[] = newFiles.map(f => ({
      file: f,
      id: nanoid(),
      status: 'idle',
      progress: 0,
    }));
    setFiles(prev => [...prev, ...newFileEntries]);
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const addLog = useCallback((fileName: string, message: string, type: LogEntry['type'] = 'info', duration?: number) => {
    setLogs(prev => [...prev, {
      id: nanoid(),
      timestamp: new Date(),
      fileName,
      message,
      type,
      duration
    }]);
  }, []);

  const handleProcess = async () => {
    if (!apiKey) {
      toast.error("请输入 API Key");
      const settingsEl = document.getElementById('settings-panel');
      if (settingsEl) {
        settingsEl.scrollIntoView({ behavior: 'smooth' });
        settingsEl.classList.add('ring-2', 'ring-primary');
        setTimeout(() => settingsEl.classList.remove('ring-2', 'ring-primary'), 2000);
      }
      return;
    }

    // Auto-save key if user is logged in
    if (user) {
        // Check if anything changed
        if (user.apiKey !== apiKey || user.model !== model || user.baseUrl !== baseUrl || user.customModelName !== customModelName) {
             saveUserSettings();
        }
    }

    setIsProcessing(true);
    setShowSettings(false);
    setLogs([]); // Clear logs for new batch

    // Process files sequentially
    for (let i = 0; i < files.length; i++) {
      const item = files[i];
      if (item.status === 'completed') continue;

      try {
        updateFileStatus(item.id, 'processing', 0);
        addLog(item.file.name, "开始解析文档...", 'info');
        
        // 1. Parse (access underlying file via item.file)
        const parsed = await parseDocument(item.file);
        
        updateFileStatus(item.id, 'translating', 10);
        addLog(item.file.name, `解析成功 (${parsed.type})，开始翻译...`, 'success');

        // 2. Translate
        const config = { 
            apiKey, 
            targetLang, 
            baseUrl: baseUrl || undefined 
        };

        const processConfig = {
            ...config,
            model: model === 'custom' ? customModelName : model
        };

        // Helper for adding logs during translation
        const logCallback = (msg: string, type: LogEntry['type'] = 'info', dur?: number) => {
          addLog(item.file.name, msg, type, dur);
        };

        let resultBlob: Blob;

        if (parsed.type === 'docx') {
          // @ts-ignore
          resultBlob = await translateDocx(parsed.structure, processConfig, (p) => {
            updateFileStatus(item.id, 'translating', 10 + (p * 0.8));
          }, logCallback);
        } else if (parsed.type === 'md') {
          resultBlob = await translateMarkdown(parsed.content, processConfig, (p) => {
            updateFileStatus(item.id, 'translating', 10 + (p * 0.8));
          }, logCallback);
        } else if (parsed.type === 'pdf' && parsed.pages) {
            resultBlob = await translatePdfPages(parsed.pages, processConfig, (completed, total) => {
                const percent = Math.round((completed / total) * 100);
                const overallProgress = 10 + (percent * 0.8);
                updateFileStatus(item.id, 'translating', overallProgress);
            }, logCallback);
        } else {
            // txt or PDF fallback
            if (parsed.type === 'pdf') {
               toast.info("PDF将以文本形式翻译并保存");
               addLog(item.file.name, "PDF将以文本形式翻译", 'warning');
            }
            resultBlob = await translatePlainFile(parsed.content, processConfig, (p) => {
                updateFileStatus(item.id, 'translating', 10 + (p * 0.8));
            }, logCallback);
        }

        // 3. Complete
        updateFileStatus(item.id, 'completed', 100);
        addLog(item.file.name, "文件处理全部完成", 'success');
        
        setFiles(prev => prev.map(f => {
            if (f.id === item.id) {
                return { ...f, resultBlob, status: 'completed', progress: 100 };
            }
            return f;
        }));

        toast.success(`${item.file.name} 翻译完成`);

      } catch (error: any) {
        console.error(error);
        updateFileStatus(item.id, 'error', 0, error.message);
        addLog(item.file.name, `处理失败: ${error.message}`, 'error');
        toast.error(`${item.file.name} 失败: ${error.message}`);
      }
    }

    setIsProcessing(false);
  };

  const updateFileStatus = (id: string, status: FileWithStatus['status'], progress: number, error?: string) => {
    setFiles(prev => prev.map(f => 
      f.id === id ? { ...f, status, progress, error } : f
    ));
  };

  const downloadFile = (item: FileWithStatus) => {
    if (item.resultBlob) {
        let ext = item.file.name.split('.').pop();
        if (item.file.type === 'application/pdf') ext = 'txt'; 
        saveAs(item.resultBlob, `translated_${item.file.name.replace(`.${ext}`, '')}.${ext}`);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/20">
      <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-primary/10 p-2 rounded-lg">
               <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/70">
              DocTranslator
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => setShowSettings(!showSettings)}>
              <Settings className={cn("w-4 h-4 mr-2 transition-transform", showSettings && "rotate-180")} />
              设置
            </Button>
            
            <div className="h-6 w-px bg-border/50" />

            {user ? (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-2">
                            <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                                {user.name[0].toUpperCase()}
                            </div>
                            {user.name}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={saveUserSettings} className="cursor-pointer">
                            <Save className="w-4 h-4 mr-2" />
                            保存当前设置
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handleLogout} className="text-destructive cursor-pointer">
                            <LogOut className="w-4 h-4 mr-2" />
                            退出登录
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            ) : (
                <AuthModal 
                    onLoginSuccess={(u) => {
                        setUser(u);
                        restoreUserSettings(u);
                    }} 
                />
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        
        {/* Settings Panel */}
        <div className={cn(
            "grid transition-all duration-300 ease-in-out overflow-hidden",
            showSettings ? "grid-rows-[1fr] opacity-100 mb-8" : "grid-rows-[0fr] opacity-0 mb-0"
        )}>
            <div className="min-h-0">
              <Card id="settings-panel" className="p-6 border-primary/20 shadow-lg bg-card/50 backdrop-blur-sm">
                  <div className="grid gap-6">
                      {/* Top Row: Key & Language */}
                      <div className="grid md:grid-cols-2 gap-6">
                          <div className="space-y-2">
                              <Label htmlFor="api-key" className="flex items-center gap-2">
                                  <Key className="w-4 h-4" /> API Key
                                  {user && (
                                    <span className="text-xs text-muted-foreground ml-auto flex items-center gap-1">
                                        {(user.apiKey === apiKey && user.model === model && user.baseUrl === baseUrl) ? "已同步" : "未保存"}
                                    </span>
                                  )}
                              </Label>
                              <div className="flex gap-2">
                                <Input 
                                    id="api-key" 
                                    type="password" 
                                    placeholder="sk-..." 
                                    value={apiKey}
                                    onChange={(e) => setApiKey(e.target.value)}
                                    className="font-mono bg-background/50"
                                />
                                {user && (user.apiKey !== apiKey || user.model !== model || user.baseUrl !== baseUrl) && apiKey && (
                                    <Button size="icon" variant="outline" onClick={saveUserSettings} title="保存配置到账户">
                                        <Save className="w-4 h-4" />
                                    </Button>
                                )}
                              </div>
                          </div>
                          
                          <div className="space-y-2">
                              <Label className="flex items-center gap-2">
                                  <Languages className="w-4 h-4" /> 目标语言
                              </Label>
                              <Select value={targetLang} onValueChange={(v: any) => setTargetLang(v)}>
                                  <SelectTrigger className="bg-background/50">
                                      <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                      <SelectItem value="auto">自动识别 (Auto)</SelectItem>
                                      <SelectItem value="zh">简体中文 (Chinese)</SelectItem>
                                      <SelectItem value="en">English</SelectItem>
                                  </SelectContent>
                              </Select>
                          </div>
                      </div>

                      {/* Bottom Row: Model & Base URL */}
                      <div className="grid md:grid-cols-2 gap-6">
                          <div className="space-y-2">
                              <Label className="flex items-center gap-2">
                                  <Bot className="w-4 h-4" /> 选择模型
                              </Label>
                              <Select value={model} onValueChange={handleModelChange}>
                                  <SelectTrigger className="bg-background/50">
                                      <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                      {MODELS.map(m => (
                                          <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                                      ))}
                                  </SelectContent>
                              </Select>
                              
                              {model === 'custom' && (
                                  <Input 
                                      placeholder="输入模型名称 (如 claude-3-opus)" 
                                      value={customModelName}
                                      onChange={(e) => setCustomModelName(e.target.value)}
                                      className="mt-2 font-mono text-sm"
                                  />
                              )}
                          </div>

                          <div className="space-y-2">
                              <Label className="flex items-center gap-2">
                                  <Server className="w-4 h-4" /> API Endpoint (Base URL)
                              </Label>
                              <Input 
                                  value={baseUrl}
                                  onChange={(e) => setBaseUrl(e.target.value)}
                                  placeholder="https://api.openai.com/v1"
                                  className="font-mono bg-background/50"
                              />
                              <p className="text-xs text-muted-foreground">如使用 DeepSeek，通常为 https://api.deepseek.com</p>
                          </div>
                      </div>
                  </div>
              </Card>
            </div>
        </div>

        {/* Main Content */}
        <div className="space-y-8">
            <div className="text-center space-y-2 mb-10">
                <h2 className="text-3xl font-bold tracking-tight">文档智能翻译</h2>
                <p className="text-muted-foreground max-w-lg mx-auto">
                    支持 .docx, .md, .pdf 格式。保持原文档排版结构，利用 AI 进行高质量上下文翻译。
                </p>
            </div>

            <FileUpload onFilesAdded={handleFilesAdded} isProcessing={isProcessing} />
            
            <FileList 
                files={files} 
                onRemove={removeFile} 
                onProcess={() => {
                    handleProcess();
                }} 
            />
            
            {/* Translation Log */}
            {logs.length > 0 && (
                <TranslationLog logs={logs} />
            )}

            {files.some(f => f.status === 'completed') && (
                <div className="mt-8 space-y-4">
                     <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-500" /> 已完成
                     </h3>
                     <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {files.filter(f => f.status === 'completed').map(item => (
                            <Card key={item.id} className="p-4 flex flex-col gap-3 hover:shadow-md transition-shadow">
                                <div className="flex items-start justify-between">
                                    <div className="truncate font-medium pr-2">{item.file.name}</div>
                                    <div className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full">Success</div>
                                </div>
                                <Button 
                                    size="sm" 
                                    variant="secondary" 
                                    className="w-full mt-auto gap-2 group"
                                    onClick={() => downloadFile(item)}
                                >
                                    <Download className="w-4 h-4 group-hover:scale-110 transition-transform" />
                                    下载译文
                                </Button>
                            </Card>
                        ))}
                     </div>
                </div>
            )}
        </div>

      </main>

      <footer className="mt-20 py-6 border-t text-center text-sm text-muted-foreground">
        <p>© 2026 DocTranslator. Pure Frontend Demo.</p>
      </footer>
    </div>
  );
}
