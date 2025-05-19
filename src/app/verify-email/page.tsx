"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export default function VerifyEmail() {
  const [isVerifying, setIsVerifying] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const supabase = createClient();

  useEffect(() => {
    let isMounted = true;

    async function verifyEmail() {
      if (!token) {
        if (isMounted) {
          setError("Invalid verification link");
          setIsVerifying(false);
        }
        return;
      }

      try {
        // Verify token through API
        const verifyResponse = await fetch('/api/verify-token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token }),
        });

        if (!verifyResponse.ok) {
          const error = await verifyResponse.json();
          throw new Error(error.message);
        }

        const { userId } = await verifyResponse.json();

        // Update user's email verification status
        const { error: updateError, data: updateData } = await supabase
          .from("users")
          .update({ is_email_verified: true })
          .eq("id", userId);


        if (updateError) {
          throw updateError;
        }

        // Verify the update
        const { data: verifyData, error: verifyError } = await supabase
          .from("users")
          .select("is_email_verified")
          .eq("id", userId)
          .single();
        

        if (isMounted) {
          toast.success("Email verified successfully! You can now log in.");
          router.push("/");
        }
      } catch (error: any) {
        console.error("❌ Error in verification process:", error);
        if (isMounted) {
          setError(error.message || "Failed to verify email. Please try again.");
          setIsVerifying(false);
        }
      }
    }

    verifyEmail();

    return () => {
      isMounted = false;
    };
  }, [token, router, supabase]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-white">
      <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
        <h1 className="text-2xl font-bold text-center mb-4">
          {isVerifying ? "Verifying your email..." : "Email Verification"}
        </h1>
        {isVerifying ? (
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : error ? (
          <>
            <p className="text-center text-red-600 mb-6">{error}</p>
            <button
              onClick={() => router.push("/")}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
            >
              Return to Home
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
} 