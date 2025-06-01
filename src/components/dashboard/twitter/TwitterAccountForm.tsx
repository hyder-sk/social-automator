"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Eye, EyeOff, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

// Form validation schema
const formSchema = z.object({
  username: z.string().min(1, "Username is required"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
  cookies: z.string().min(1, "Cookies are required").refine(
    (value) => {
      try {
        // Check if it's a valid cookie string format (key=value; key2=value2)
        const cookies = value.split(';').map(cookie => cookie.trim());
        return cookies.length > 0 && cookies.every(cookie => {
          const [key, value] = cookie.split('=');
          return key && value;
        });
      } catch {
        return false;
      }
    },
    "Invalid cookie format. Please provide cookies in format: key=value; key2=value2"
  ),
  proxy_username: z.string().min(1, "Proxy username is required"),
  proxy_password: z.string().min(1, "Proxy password is required"),
  proxy_ip: z.string().min(1, "Proxy IP is required"),
  proxy_port: z.coerce.number().min(1, "Proxy port is required"),
});

type FormValues = z.infer<typeof formSchema>;

interface TwitterAccountFormProps {
  onSuccess?: () => void;
}

export function TwitterAccountForm({ onSuccess }: TwitterAccountFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showProxyPassword, setShowProxyPassword] = useState(false);
  const [isCookiesValid, setIsCookiesValid] = useState<boolean | null>(null);
  const supabase = createClient();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
      cookies: "",
      proxy_username: "",
      proxy_password: "",
      proxy_ip: "",
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
      const cookieArray = cookies.split(';').map(cookie => cookie.trim());
      const isValid = cookieArray.length > 0 && cookieArray.every(cookie => {
        const [key, value] = cookie.split('=');
        return key && value;
      });
      setIsCookiesValid(isValid);
    } catch {
      setIsCookiesValid(false);
    }
  }, [cookies]);

  const onSubmit = async (values: FormValues) => {
    setIsLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("User not authenticated");
      }

      const response = await fetch("/api/twitter/add-account", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: values.username,
          email: values.email,
          password: values.password,
          cookies: values.cookies,
          proxy_username: values.proxy_username,
          proxy_password: values.proxy_password,
          proxy_ip: values.proxy_ip,
          proxy_port: values.proxy_port,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to add Twitter account");
      }

      toast.success("Twitter account added successfully");
      form.reset();
      setIsOpen(false);
      onSuccess?.();
    } catch (error) {
      console.error("Error adding Twitter account:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to add Twitter account"
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="bg-[#1DA1F2] hover:bg-[#1a8cd8] text-white">
          Add New Account
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Twitter Account</DialogTitle>
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
                    <Input placeholder="Enter Twitter username" {...field} />
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
                    <Input placeholder="Enter Twitter email" {...field} />
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
                        type={showProxyPassword ? "text" : "password"}
                        placeholder="Enter Twitter password"
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
              name="cookies"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cookies</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input 
                        placeholder="guest_id=v1%3A123456789; auth_token=abc123def456; ct0=xyz789; _twitter_sess=ABC123DEF456; ..." 
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
                  <FormLabel>Proxy username</FormLabel>
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
                  <FormLabel>Proxy password</FormLabel>
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
              className="w-full bg-[#1DA1F2] hover:bg-[#1a8cd8] text-white"
              disabled={isLoading}
            >
              {isLoading ? "Adding..." : "Add Account"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
