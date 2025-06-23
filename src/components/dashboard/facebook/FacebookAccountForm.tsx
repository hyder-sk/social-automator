'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Eye, EyeOff, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from "@/lib/utils";

// Form validation schema
const formSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
  cookies: z.string().min(1, 'Cookies are required').refine(
    (value) => {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) && parsed.length > 0 && parsed.every(cookie => 
          cookie.domain && cookie.name && cookie.value
        );
      } catch {
        return false;
      }
    },
    "Invalid cookie format. Please provide cookies in JSON array format"
  ),
  proxy_username: z.string().min(1, "Proxy username is required"),
  proxy_password: z.string().min(1, "Proxy password is required"),
  proxy_ip: z.string().min(1, "Proxy IP is required"),
  proxy_port: z.coerce.number().min(1, "Proxy port is required"),
});

type FormValues = z.infer<typeof formSchema>;

interface FacebookAccountFormProps {
  onSuccess?: () => void;
}

export function FacebookAccountForm({ onSuccess }: FacebookAccountFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showProxyPassword, setShowProxyPassword] = useState(false);
  const [isCookiesValid, setIsCookiesValid] = useState<boolean | null>(null);
  const supabase = createClient();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: '',
      password: '',
      cookies: '',
      proxy_username: '',
      proxy_password: '',
      proxy_ip: '',
      proxy_port: 0,
    },
  });

  // Watch cookies field for validation
  const cookies = form.watch('cookies');
  
  // Validate cookies on change
  useEffect(() => {
    if (!cookies) {
      setIsCookiesValid(null);
      return;
    }
    
    try {
      const parsed = JSON.parse(cookies);
      const isValid = Array.isArray(parsed) && 
                     parsed.length > 0 && 
                     parsed.every(cookie => cookie.domain && cookie.name && cookie.value);
      setIsCookiesValid(isValid);
    } catch {
      setIsCookiesValid(false);
    }
  }, [cookies]);

  const onSubmit = async (values: FormValues) => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Send cookies string directly without parsing
      const response = await fetch('/api/facebook/add-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: values.username,
          password: values.password,
          cookies: values.cookies, // Send the string directly
          proxy_username: values.proxy_username,
          proxy_password: values.proxy_password,
          proxy_ip: values.proxy_ip,
          proxy_port: values.proxy_port,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add Facebook account');
      }

      const result = await response.json();
      
      if (result.error) {
        throw new Error(result.error);
      }

      toast.success('Facebook account added successfully');
      form.reset();
      setIsOpen(false);
      onSuccess?.();
    } catch (error) {
      console.error('Error adding Facebook account:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to add Facebook account');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="bg-[#1877F2] hover:bg-[#0B5ED7] text-white">
          Add New Account
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Facebook Account</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter Facebook username" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter Facebook password"
                        {...field}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="cookies"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cookies (JSON Array)</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input 
                        placeholder='[{"domain":".facebook.com","name":"datr","value":"abc123"},{"domain":".facebook.com","name":"c_user","value":"123456789"}]' 
                        {...field} 
                        className={cn(
                          "font-mono text-sm pr-10",
                          isCookiesValid === true && "border-green-500 focus-visible:ring-green-500",
                          isCookiesValid === false && "border-red-500 focus-visible:ring-red-500"
                        )}
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {isCookiesValid === true && (
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        )}
                        {isCookiesValid === false && (
                          <XCircle className="h-5 w-5 text-red-500" />
                        )}
                      </div>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="proxy_username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Proxy Username</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter proxy username" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="proxy_password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Proxy Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showProxyPassword ? "text" : "password"}
                        placeholder="Enter proxy password"
                        {...field}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowProxyPassword(!showProxyPassword)}
                      >
                        {showProxyPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="proxy_ip"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Proxy IP</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter proxy IP" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="proxy_port"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Proxy Port</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="Enter proxy port" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button 
              type="submit" 
              className="w-full bg-[#1877F2] hover:bg-[#0B5ED7] text-white"
              disabled={isLoading}
            >
              {isLoading ? 'Adding...' : 'Add Account'}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
} 