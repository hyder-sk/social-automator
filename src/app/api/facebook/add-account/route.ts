import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { BrowserContext, Cookie, Page } from "playwright";
import { createStealthSetup } from "@/lib/playwright-config";

// Schema for request validation
const addAccountSchema = z.object({
  username: z.string().min(1, "Username is required"),
  email: z.string().email(),
  password: z.string().min(1),
  proxy_username: z.string().min(1, "Proxy username is required"),
  proxy_password: z.string().min(1, "Proxy password is required"),
  proxy_ip: z.string().min(1, "Proxy IP is required"),
  proxy_port: z.string().min(1, "Proxy port is required"),
});

const randomDelay = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

export async function POST(request: Request) {
  try {
    // Get user session
    let context: BrowserContext | null = null;
    let page: Page | null = null;

    const cookieStore = cookies();
    const supabase = await createClient(cookieStore);
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse and validate request body
    const body = await request.json();
    const {
      username,
      email,
      password,
      proxy_username,
      proxy_password,
      proxy_ip,
      proxy_port,
    } = addAccountSchema.parse(body);

    const proxyConfig =
      proxy_ip && proxy_port
        ? {
            type: "http",
            server: proxy_ip,
            port: proxy_port.toString(),
            username: proxy_username || "",
            password: proxy_password || "",
          }
        : undefined;

    // Create browser with stealth configuration and HTTPS proxy, in headed mode
    const { context: newContext, page: newPage } = await createStealthSetup(
      undefined,
      proxyConfig,
      false
    );
    context = newContext;
    page = newPage;

    // Facebook account already exists.find by email
    const { data: account, error: dbError } = await supabase
      .from("social_accounts")
      .select("*")
      .eq("email", email)
      .eq("platform", "facebook")
      .single();

    if (account) {
      return NextResponse.json({
        success: false,
        message: "Facebook account already exists",
      });
    }

    if (!page) {
      throw new Error("Failed to create new page");
    }

    try {
      // Navigate to Facebook login
      await page.goto("https://www.facebook.com/");

      // Fill in login credentials
      await page.fill('input[name="email"]', email);
      await page.fill('input[name="pass"]', password);
      await page.click('button[name="login"]');

      // Wait for login to complete (5 minutes timeout)
      try {
        await Promise.race([
          page.waitForSelector('[aria-label="Account controls and settings"]', {
            timeout: 300000,
          }),
          page.waitForSelector('[aria-label="Your profile"]', {
            timeout: 300000,
          }),
          page.waitForSelector('[aria-label="Create"]', { timeout: 300000 }),
        ]);
      } catch (error) {
        throw new Error(
          "Login timeout - please complete the login process within 5 minutes"
        );
      }

      // Get cookies after successful login
      const cookies = await context.cookies();
      const cookieString = cookies
        .map((cookie: Cookie) => `${cookie.name}=${cookie.value}`)
        .join("; ");

      // Store account details in Supabase with proxy configuration
      const { data: newAccount, error: dbError } = await supabase
        .from("social_accounts")
        .insert({
          user_id: session.user.id,
          platform: "facebook",
          type: "manual",
          username: username,
          email: email,
          password: password,
          cookies: cookieString,
          proxy_type: proxyConfig?.type || "http",
          proxy_ip: proxyConfig?.server || "",
          proxy_port: proxyConfig?.port || "",
          proxy_username: proxyConfig?.username || "",
          proxy_password: proxyConfig?.password || "",
          proxy_country: "US",
          proxy_rotation_interval: 3600,
          status: "active",
        })
        .select()
        .single();

      if (dbError) {
        throw new Error(`Failed to store account: ${dbError.message}`);
      }

      return NextResponse.json({
        success: true,
        message: "Facebook account added successfully",
        account: newAccount,
      });
    } finally {
      if (context) await context.close();
    }
  } catch (error) {
    console.error("Error adding Facebook account:", error);
    return NextResponse.json(
      {
        error: "Failed to add Facebook account",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
