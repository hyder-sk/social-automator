import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { logError } from '@/lib/error-logger';

// Schema for request validation
const addAccountSchema = z.object({
  username: z.string().min(1, "Username is required"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
  cookies: z.string().min(1, "Cookies are required"),
  proxy_username: z.string().min(1, "Proxy username is required"),
  proxy_password: z.string().min(1, "Proxy password is required"),
  proxy_ip: z.string().min(1, "Proxy IP is required"),
  proxy_port: z.coerce.number().min(1, "Proxy port is required"),
});

// Convert Twitter cookie string to array of cookie objects
function convertTwitterCookies(cookieString: string) {
  try {
    // Split by semicolon and filter out empty strings
    const cookies = cookieString
      .split(';')
      .map(cookie => cookie.trim())
      .filter(cookie => cookie.length > 0);
    
    if (cookies.length === 0) {
      throw new Error('No valid cookies found in the string');
    }
    
    return cookies.map(cookie => {
      const equalIndex = cookie.indexOf('=');
      if (equalIndex === -1) {
        throw new Error(`Invalid cookie format: ${cookie}`);
      }
      
      const name = cookie.substring(0, equalIndex).trim();
      const value = cookie.substring(equalIndex + 1).trim();
      
      if (!name || !value) {
        throw new Error(`Invalid cookie format: ${cookie}`);
      }
      
      return {
        name,
        value,
        domain: '.x.com',
        path: '/',
        secure: true,
        httpOnly: true,
        sameSite: 'None'
      };
    });
  } catch (error) {
    console.error('Error converting cookies:', error);
    throw new Error('Invalid cookie format. Please provide cookies in the format: name=value; name2=value2');
  }
}

export async function POST(request: NextRequest) {
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
      email,
      password,
      cookies: cookieString,
      proxy_username,
      proxy_password,
      proxy_ip,
      proxy_port,
    } = addAccountSchema.parse(body);

    if (!username || !email || !password || !cookieString) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Convert cookie string to array of cookie objects
    let formattedCookies;
    try {
      formattedCookies = convertTwitterCookies(cookieString);
      } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Invalid cookie format' },
        { status: 400 }
      );
    }

    // Check if account already exists
    const { data: existingAccount } = await supabase
      .from('social_accounts')
      .select('id, status')
      .eq('user_id', user.id)
      .eq('platform', 'twitter')
      .eq('username', username)
      .eq('deleted_at', null)
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
          platform: 'twitter',
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
        platform: 'twitter',
        type: 'manual',
        username,
                email,
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
        message: 'Failed to add Twitter account',
        error: insertError,
        metadata: {
          username,
          platform: 'twitter',
        },
      });

      // Log failed task for database error
      await supabase.from('tasks').insert({
        user_id: user.id,
        type: 'add-account',
        status: 'failed',
        platform: 'twitter',
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
      platform: 'twitter',
      social_account_id: account.id,
      task_logs: [{
        execution_time: new Date().toISOString(),
        result: 'success',
        message: `Successfully added Twitter account: ${username}`
      }]
    });

    return NextResponse.json({ account });
  } catch (error) {
    console.error('Error in add-account:', error);
    
    // Log error to error logger
    await logError({
      category: 'account_verification',
      message: 'Failed to add Twitter account',
      error,
      metadata: {
        platform: 'twitter',
      },
    });

    // Log failed task if we have a valid supabase client
    if (supabase) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from('tasks').insert({
            user_id: user.id,
            type: 'add-account',
            status: 'failed',
            platform: 'twitter',
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
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}