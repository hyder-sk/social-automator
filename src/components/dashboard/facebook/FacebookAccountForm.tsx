'use client';

import { useState } from 'react';
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

// Form validation schema
const formSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  proxy_username: z.string().min(1, "Proxy username is required"),
  proxy_password: z.string().min(1, "Proxy password is required"),
  proxy_ip: z.string().min(1, "Proxy IP is required"),
  proxy_port: z.string().min(1, "Proxy port is required"),
});

type FormValues = z.infer<typeof formSchema>;

interface FacebookAccountFormProps {
  onSuccess?: () => void;
}

export function FacebookAccountForm({ onSuccess }: FacebookAccountFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const supabase = createClient();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: '',
      email: '',
      password: '',
      proxy_username: '',
      proxy_password: '',
      proxy_ip: '',
      proxy_port: '',
    },
  });

  const onSubmit = async (values: FormValues) => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Call our new API endpoint that handles Chrome automation
      const response = await fetch('/api/facebook/add-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: values.username,
          email: values.email,
          password: values.password,
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
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter Facebook email" {...field} />
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
                    <Input type="password" placeholder="Enter Facebook password" {...field} />
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
                    <Input type="password" placeholder="Enter proxy password" {...field} />
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
                    <Input placeholder="Enter proxy port" {...field} />
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