"use client";

import { useState } from "react";
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
import { Eye, EyeOff } from "lucide-react";

// Form validation schema
const formSchema = z.object({
  username: z.string().min(1, "Username is required"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
  proxy_username: z.string().min(1, "Proxy username is required"),
  proxy_password: z.string().min(1, "Proxy password is required"),
  proxy_ip: z.string().min(1, "Proxy IP is required"),
  proxy_port: z.coerce.number().min(1, "Proxy port is required"),
  //optional
  mail_password: z.string().optional(),
  mfa_code: z.string().refine((val) => val !== "", "MFA code is required"),
});

type FormValues = z.infer<typeof formSchema>;

interface TwitterAccountFormProps {
  onSuccess?: () => void;
}

export function TwitterAccountForm({ onSuccess }: TwitterAccountFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showProxyPassword, setShowProxyPassword] = useState(false);
  const supabase = createClient();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
      proxy_username: "",
      proxy_password: "",
      proxy_ip: "",
      proxy_port: 0,
      mail_password: "",
      mfa_code: "",
    },
  });

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
          proxy_username: values.proxy_username,
          proxy_password: values.proxy_password,
          proxy_ip: values.proxy_ip,
          proxy_port: values.proxy_port,
          mail_password: values.mail_password,
          mfa_code: values.mfa_code,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.log(error);
        throw new Error("Failed to add Twitter account. Please try again!");
      }

      const result = await response.json();

      if (result.error) {
        throw new Error(result.error);
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
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter Twitter password"
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
            <FormField
              control={form.control}
              name="mail_password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mail Password</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter mail password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="mfa_code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>MFA Code</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter MFA code" {...field} />
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
