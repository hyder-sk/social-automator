"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { sendVerificationEmail } from "@/lib/utils";

const formSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  firstName: z
    .string()
    .min(2, "First name must be at least 2 characters")
    .optional(),
  lastName: z
    .string()
    .min(2, "Last name must be at least 2 characters")
    .optional(),
});

interface AuthFormProps {
  isLogin?: boolean;
}

interface UserData {
  id: string;
  email: string;
  is_email_verified: boolean;
}

const AuthForm: React.FC<AuthFormProps> = ({ isLogin = true }): React.ReactElement => {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
      firstName: "",
      lastName: "",
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const values = form.getValues();
    setIsLoading(true);

    try {
      if (isLogin) {
        // Sign in with Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email: values.email,
          password: values.password,
        });

        if (authError) throw authError;
        if (!authData.user) throw new Error('No user data returned');

        // Store user email in localStorage
        localStorage.setItem('userEmail', values.email);

        // Skip email verification check
        toast.success("Successfully logged in!");
        router.push("/dashboard");
      } else {
        // First check if user already exists
        const { data: existingUser, error: checkError } = await supabase
          .from("users")
          .select("id")
          .eq("email", values.email)
          .single();

        if (existingUser) {
          throw new Error("An account with this email already exists. Please login instead.");
        }

        // Sign up with Supabase Auth first
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: values.email,
          password: values.password,
        });

        if (authError) {
          console.error("Auth signup error:", authError);
          throw authError;
        }

        if (!authData.user) {
          throw new Error("Failed to create user account");
        }

        // Store user email in localStorage
        localStorage.setItem('userEmail', values.email);

        // Then create the user in the users table with email verification bypassed
        const { data: userData, error: userError } = await supabase
          .from("users")
          .insert([
            {
              id: authData.user.id,
              email: values.email,
              first_name: values.firstName,
              last_name: values.lastName,
              role: "user",
              is_email_verified: true, // Set to true to bypass verification
            },
          ])
          .select()
          .single();

        if (userError) {
          console.error("User creation error:", userError);
          throw new Error("Failed to create user account. Please try again.");
        }

        toast.success("Account created successfully!");
        router.push("/dashboard");
      }
    } catch (error: any) {
      console.error("Auth error:", error);
      toast.error(
        error.message || "An unexpected error occurred. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto border-0 shadow-none">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold text-center">
          {isLogin ? "Welcome Back" : "Create Account"}
        </CardTitle>
        <CardDescription className="text-center">
          {isLogin
            ? "Enter your credentials to access your account"
            : "Create a new account to get started"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <>
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  {...form.register("firstName")}
                  disabled={isLoading}
                />
                {form.formState.errors.firstName && (
                  <p className="text-sm text-red-500">
                    {form.formState.errors.firstName.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  {...form.register("lastName")}
                  disabled={isLoading}
                />
                {form.formState.errors.lastName && (
                  <p className="text-sm text-red-500">
                    {form.formState.errors.lastName.message}
                  </p>
                )}
              </div>
            </>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              {...form.register("email")}
              disabled={isLoading}
            />
            {form.formState.errors.email && (
              <p className="text-sm text-red-500">
                {form.formState.errors.email.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              {...form.register("password")}
              disabled={isLoading}
            />
            {form.formState.errors.password && (
              <p className="text-sm text-red-500">
                {form.formState.errors.password.message}
              </p>
            )}
          </div>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Loading..." : isLogin ? "Sign In" : "Sign Up"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default AuthForm;
