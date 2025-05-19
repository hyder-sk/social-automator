import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/client";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { message: "Verification token is required" },
        { status: 400 }
      );
    }

    const supabase = createClient();

    // Update user's email verification status
    const { error } = await supabase
      .from('users')
      .update({ is_email_verified: true })
      .eq('id', token);

    if (error) {
      console.error('Error verifying email:', error);
      return NextResponse.json(
        { message: "Failed to verify email" },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: "Email verified successfully" });
  } catch (error) {
    console.error('Error in verify-email route:', error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
} 