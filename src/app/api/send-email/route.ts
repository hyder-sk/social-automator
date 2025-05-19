import { NextResponse } from "next/server";
import nodemailer from 'nodemailer';
import { generateVerificationToken } from '@/lib/jwt';

// Create a transporter using SMTP
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

export async function POST(request: Request) {
  try {
    const { email, userId } = await request.json();
    
    // Generate JWT token
    const token = generateVerificationToken(userId);
    
    // Get the origin from the request
    const origin = request.headers.get('origin')
    const verificationLink = `${origin}/verify-email?token=${token}`;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Verify Your Email - Social Media Automator',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1877F2;">Welcome to Social Media Automator!</h2>
          <p>Thank you for signing up. Please verify your email address to complete your registration.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationLink}" 
               style="background-color: #1877F2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
              Verify Email
            </a>
          </div>
          <p>If the button doesn't work, you can also copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #666;">${verificationLink}</p>
          <p style="margin-top: 30px; color: #666; font-size: 12px;">
            If you didn't create an account, you can safely ignore this email.
          </p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    return NextResponse.json({ message: "Verification email sent successfully" });
  } catch (error: any) {
    console.error('Error sending verification email:', error);
    return NextResponse.json(
      { message: error.message || "Failed to send verification email" },
      { status: 500 }
    );
  }
} 