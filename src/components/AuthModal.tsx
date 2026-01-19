import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from 'sonner';
import { authService, type User } from '@/lib/auth-service';
import { Loader2 } from 'lucide-react';

interface AuthModalProps {
  onLoginSuccess: (user: User) => void;
  trigger?: React.ReactNode;
}

export function AuthModal({ onLoginSuccess, trigger }: AuthModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);

  const handleAuth = async (isRegister: boolean) => {
    if (!email || !password) {
      toast.error("请输入邮箱和密码");
      return;
    }

    setIsLoading(true);
    try {
      let user;
      if (isRegister) {
        user = await authService.register(email, password, rememberMe);
        toast.success("注册成功");
      } else {
        user = await authService.login(email, password, rememberMe);
        toast.success("登录成功");
      }
      setIsOpen(false);
      onLoginSuccess(user);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || <Button variant="outline">登录 / 注册</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="text-center">欢迎使用 DocTranslator</DialogTitle>
          <DialogDescription className="text-center">
            登录后可自动保存您的 API Key 设置
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="login" className="w-full mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">登录</TabsTrigger>
            <TabsTrigger value="register">注册</TabsTrigger>
          </TabsList>
          
          <TabsContent value="login" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="email-login">邮箱</Label>
              <Input id="email-login" type="email" placeholder="name@example.com" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password-login">密码</Label>
              <Input id="password-login" type="password" value={password} onChange={e => setPassword(e.target.value)} />
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="remember-me" 
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(checked as boolean)}
              />
              <label
                htmlFor="remember-me"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                记住我 (下次自动登录)
              </label>
            </div>

            <Button className="w-full mt-4" onClick={() => handleAuth(false)} disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              登录
            </Button>
          </TabsContent>
          
          <TabsContent value="register" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="email-register">邮箱</Label>
              <Input id="email-register" type="email" placeholder="name@example.com" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password-register">密码</Label>
              <Input id="password-register" type="password" value={password} onChange={e => setPassword(e.target.value)} />
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="remember-me-register" 
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(checked as boolean)}
              />
              <label
                htmlFor="remember-me-register"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                记住我
              </label>
            </div>

            <Button className="w-full mt-4" onClick={() => handleAuth(true)} disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              注册并登录
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
