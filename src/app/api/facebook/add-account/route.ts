import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { BrowserContext, Cookie, Page } from "playwright";
import { createStealthSetup } from "@/lib/playwright-config";
import { logError } from '@/lib/error-logger';

// Schema for request validation
const addAccountSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1),
  proxy_username: z.string().min(1, "Proxy username is required"),
  proxy_password: z.string().min(1, "Proxy password is required"),
  proxy_ip: z.string().min(1, "Proxy IP is required"),
  proxy_port: z.coerce.number().min(1, "Proxy port is required"),
});

const randomDelay = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

interface FacebookCookie {
  domain: string;
  expirationDate: number;
  hostOnly: boolean;
  httpOnly: boolean;
  name: string;
  path: string;
  sameSite: string;
  secure: boolean;
  session: boolean;
  storeId: string;
  value: string;
}

export async function POST(request: Request) {
  const cookieStore = cookies();
  const supabase = await createClient(cookieStore);

  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      username,
      password,
      cookies: accountCookies,
      proxy_username,
      proxy_password,
      proxy_ip,
      proxy_port,
    } = body;

    if (!username || !password || !accountCookies) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Parse and validate cookies
    let parsedCookies: FacebookCookie[];
    try {
      // First try to parse if it's a string
      const cookiesToParse = typeof accountCookies === 'string' ? accountCookies : JSON.stringify(accountCookies);
      parsedCookies = JSON.parse(cookiesToParse);
      
      if (!Array.isArray(parsedCookies)) {
        throw new Error('Cookies must be an array');
      }

      // Validate required cookie fields
      const requiredFields = ['name', 'value', 'domain', 'path'] as const;
      for (const cookie of parsedCookies) {
        for (const field of requiredFields) {
          if (!cookie[field]) {
            throw new Error(`Cookie is missing required field: ${field}`);
          }
        }
      }
    } catch (e: unknown) {
      console.error('Cookie parsing error:', e);
      const errorMessage = e instanceof Error ? e.message : 'Unknown error';
      return NextResponse.json(
        { error: `Invalid cookies format: ${errorMessage}` },
        { status: 400 }
      );
    }

    // Format cookies for Playwright
    const formattedCookies = parsedCookies.map(cookie => ({
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain,
      path: cookie.path,
      expires: cookie.expirationDate,
      httpOnly: cookie.httpOnly,
      secure: cookie.secure,
      sameSite: cookie.sameSite === 'no_restriction' ? 'none' : cookie.sameSite,
    }));

    // Check if account already exists
    const { data: existingAccount } = await supabase
      .from('social_accounts')
      .select('id, status')
      .eq('user_id', user.id)
      .eq('platform', 'facebook')
      .eq('username', username)
      .single();

    if (existingAccount) {
      if (existingAccount.status === 'pending') {
        // Delete pending account
        await supabase
          .from('social_accounts')
          .delete()
          .eq('id', existingAccount.id);
      } else {
        // Log failed task for duplicate account
        await supabase.from('tasks').insert({
          user_id: user.id,
          type: 'add-account',
          status: 'failed',
          platform: 'facebook',
          task_logs: [{
            execution_time: new Date().toISOString(),
            result: 'failed',
            message: `Account with username ${username} already exists`
          }]
        });

        return NextResponse.json(
          { error: 'Account already exists' },
          { status: 400 }
        );
      }
    }

    // Insert new account with cookies
    const { data: account, error: insertError } = await supabase
      .from('social_accounts')
      .insert({
        user_id: user.id,
        platform: 'facebook',
        type: 'manual',
        username,
        password,
        cookies: formattedCookies,
        proxy_username,
        proxy_password,
        proxy_ip,
        proxy_port,
        status: 'active',
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting account:', insertError);
      await logError({
        userId: user.id,
        category: 'account_verification',
        message: 'Failed to add Facebook account',
        error: insertError,
        metadata: {
          username,
          platform: 'facebook',
        },
      });

      // Log failed task for database error
      await supabase.from('tasks').insert({
        user_id: user.id,
        type: 'add-account',
        status: 'failed',
        platform: 'facebook',
        task_logs: [{
          execution_time: new Date().toISOString(),
          result: 'failed',
          message: `Failed to create account: ${insertError.message}`
        }]
      });

      return NextResponse.json(
        { error: 'Failed to add account' },
        { status: 500 }
      );
    }

    // Log successful task
    await supabase.from('tasks').insert({
      user_id: user.id,
      type: 'add-account',
      status: 'completed',
      platform: 'facebook',
      social_account_id: account.id,
      task_logs: [{
        execution_time: new Date().toISOString(),
        result: 'success',
        message: `Successfully added Facebook account: ${username}`
      }]
    });

    return NextResponse.json({ account });
  } catch (error) {
    console.error('Error in add-account:', error);
    await logError({
      category: 'account_verification',
      message: 'Failed to add Facebook account',
      error,
      metadata: {
        platform: 'facebook',
      },
    });

    // Log failed task for any other errors
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('tasks').insert({
          user_id: user.id,
          type: 'add-account',
          status: 'failed',
          platform: 'facebook',
          task_logs: [{
            execution_time: new Date().toISOString(),
            result: 'failed',
            message: error instanceof Error ? error.message : 'Unknown error occurred'
          }]
        });
      }
    } catch (logError) {
      console.error('Error logging failed task:', logError);
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
