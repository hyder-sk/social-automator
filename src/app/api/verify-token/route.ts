import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/jwt";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const { token } = await request.json();
    const supabase = await createClient();

    if (!token) {
      return NextResponse.json(
        { message: "Token is required" },
        { status: 400 }
      );
    }

    const decoded = verifyToken(token);
    
    if (!decoded) {
      return NextResponse.json(
        { message: "Invalid or expired verification link" },
        { status: 400 }
      );
    }

    // Check auth.users table
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(decoded.userId);

    // Check public.users table
    const { data: publicUser, error: publicError } = await supabase
      .from("users")
      .select("*")
      .eq("id", decoded.userId)
      .single();

    return NextResponse.json({ userId: decoded.userId });
  } catch (error: any) {
    console.error("❌ Error in verify-token:", error);
    return NextResponse.json(
      { message: error.message || "Failed to verify token" },
      { status: 500 }
    );
  }
} 