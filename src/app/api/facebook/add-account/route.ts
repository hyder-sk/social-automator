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
  proxy_port: z.coerce.number().min(1, "Proxy port is required"),
});

const randomDelay = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

export async function POST(request: Request) {
  let context: BrowserContext | null = null;
  let page: Page | null = null;
  let supabase;
  let session;
  let proxy_ip: string | undefined;
  let proxy_port: string | undefined;
  let task: { id: string } | null = null;

  try {
    // Get user session
    const cookieStore = cookies();
    supabase = await createClient(cookieStore);
    const {
      data: { session: authSession },
    } = await supabase.auth.getSession();

    if (!authSession) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    session = authSession;

    // Parse and validate request body
    const body = await request.json();
    const {
      username,
      email,
      password,
      proxy_username,
      proxy_password,
      proxy_ip: reqProxyIp,
      proxy_port: reqProxyPort,
    } = addAccountSchema.parse(body);

    proxy_ip = reqProxyIp;
    proxy_port = reqProxyPort.toString();

    const proxyConfig =
      proxy_ip && proxy_port
        ? {
            type: "http",
            server: proxy_ip,
            port: proxy_port,
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

    // Check if account already exists
    const { data: existingAccount, error: dbError } = await supabase
      .from('social_accounts')
      .select('*')
      .eq('email', email)
      .eq('platform', 'facebook')
      .single();

    if (existingAccount) {
      // If account exists and is active, return error
      if (existingAccount.status === 'active') {
        return NextResponse.json({
          success: false,
          message: "Facebook account already exists and is active"
        });
      }
      
      // If account exists but is pending, we'll update it later
      console.log("Found existing pending account, will update it");
    }

    // Create or update social account first
    let account;
    if (existingAccount && existingAccount.status === 'pending') {
      // Update existing pending account
      const { data: updatedAccount, error: updateError } = await supabase
        .from("social_accounts")
        .update({
          username: username,
          status: 'pending',
          proxy_ip: proxy_ip,
          proxy_port: proxy_port,
          proxy_username: proxy_username,
          proxy_password: proxy_password,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingAccount.id)
        .select()
        .single();
      
      account = updatedAccount;
      if (updateError) {
        throw new Error("Failed to update existing account");
      }
    } else {
      // Create new account
      const { data: newAccount, error: insertError } = await supabase
        .from("social_accounts")
        .insert([
          {
            user_id: session.user.id,
            platform: "facebook",
            type: "manual",
            email,
            password,
            username,
            status: 'pending',
            proxy_ip: proxy_ip,
            proxy_port: proxy_port,
            proxy_username: proxy_username,
            proxy_password: proxy_password,
          },
        ])
        .select()
        .single();
      
      account = newAccount;
      if (insertError) {
        throw new Error("Failed to create new account");
      }
    }

    // Now create the task with the social account ID
    const taskData = {
      user_id: session.user.id,
      social_account_id: account.id,
      type: 'add_account',
      action_data: {
        username,
        email,
        operation: 'add_account'
      },
      schedule_type: 'once',
      schedule_data: {},
      status: 'pending',
      next_run_at: new Date().toISOString()
    };

    // Insert task into database
    const { data: newTask, error: taskError } = await supabase
      .from('tasks')
      .insert([taskData])
      .select()
      .single();

    if (taskError) {
      console.error('Task creation error:', taskError);
      throw new Error('Failed to create task');
    }

    task = newTask;

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
      let loggedIn = false;
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
        loggedIn = true;
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

      try {
        // Store account in database
        let account;
        let accountError;

        if (existingAccount && existingAccount.status === 'pending') {
          // Update existing pending account
          const { data: updatedAccount, error: updateError } = await supabase
            .from("social_accounts")
            .update({
              username: username,
              cookies: cookieString,
              status: loggedIn ? "active" : "pending",
              proxy_ip: proxy_ip,
              proxy_port: proxy_port,
              proxy_username: proxy_username,
              proxy_password: proxy_password,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingAccount.id)
            .select()
            .single();
          
          account = updatedAccount;
          accountError = updateError;
        } else {
          // Create new account
          const { data: newAccount, error: insertError } = await supabase
            .from("social_accounts")
            .insert([
              {
                user_id: session.user.id,
                platform: "facebook",
                type: "manual",
                email,
                password,
                username,
                cookies: cookieString,
                status: loggedIn ? "active" : "pending",
                proxy_ip: proxy_ip,
                proxy_port: proxy_port,
                proxy_username: proxy_username,
                proxy_password: proxy_password,
              },
            ])
            .select()
            .single();
          
          account = newAccount;
          accountError = insertError;
        }

        if (accountError) {
          console.error("Account creation/update error:", accountError);
          
          // Log the failure in task_logs
          try {
            if (task) {
              const { error: logError } = await supabase
                .from('task_logs')
                .insert([{
                  task_id: task.id,
                  execution_time: new Date().toISOString(),
                  result: 'failed',
                  message: `Failed to store account in database due to ${accountError.message}`,
                  proxy_used: `${proxy_ip}:${proxy_port}`,
                }]);

              if (logError) {
                console.error('Failed to log task failure:', logError);
              }

              // Update task status
              await supabase
                .from('tasks')
                .update({ status: 'failed' })
                .eq('id', task.id);
            }
          } catch (logError) {
            console.error('Error logging task failure:', logError);
          }

          throw new Error("Failed to store account in database");
        }

        // If account is active, delete any other pending accounts with the same email
        if (loggedIn && account) {
          const { error: deleteError } = await supabase
            .from('social_accounts')
            .delete()
            .eq('email', email)
            .eq('platform', 'facebook')
            .eq('status', 'pending')
            .neq('id', account.id);

          if (deleteError) {
            console.error('Error deleting pending accounts:', deleteError);
          }
        }

        // After successful account creation/update, update the task with the account ID
        if (account && task) {
          await supabase
            .from('tasks')
            .update({
              social_account_id: account.id,
              status: loggedIn ? 'completed' : 'pending'
            })
            .eq('id', task.id);

          // Log success to task_logs
          await supabase
            .from('task_logs')
            .insert([{
              task_id: task.id,
              execution_time: new Date().toISOString(),
              result: 'success',
              message: loggedIn ? 'Account added successfully' : 'Account added with pending status',
              proxy_used: `${proxy_ip}:${proxy_port}`
            }]);
        }

        return NextResponse.json({
          success: true,
          message: loggedIn
            ? "Account added successfully"
            : "Account added with pending status - may require manual verification",
          account,
        });
      } catch (dbError) {
        console.error("Database error:", dbError);
        
        // Log the failure in task_logs
        try {
          if (task) {
            const { error: logError } = await supabase
              .from('task_logs')
              .insert([{
                task_id: task.id,
                execution_time: new Date().toISOString(),
                result: 'failed',
                message: `Failed to store account in database due to ${dbError instanceof Error ? dbError.message : String(dbError)}`,
                proxy_used: `${proxy_ip}:${proxy_port}`,
              }]);

            if (logError) {
              console.error('Failed to log task failure:', logError);
            }

            // Update task status
            await supabase
              .from('tasks')
              .update({ status: 'failed' })
              .eq('id', task.id);
          }
        } catch (logError) {
          console.error('Error logging task failure:', logError);
        }

        throw new Error(
          "Failed to store account in database: " +
            (dbError instanceof Error ? dbError.message : String(dbError))
        );
      }
    } catch (error) {
      console.error("Error adding account:", error);
      throw error;
    }
  } catch (error) {
    console.error("Error adding account:", error);
    
    // Add failed status to task_logs if we have supabase and session
    if (supabase && session && task) {
      try {
        const { error: logError } = await supabase
          .from('task_logs')
          .insert([{
            task_id: task.id,
            execution_time: new Date().toISOString(),
            result: 'failed',
            message: error instanceof Error ? error.message : 'Failed to add account',
            proxy_used: proxy_ip && proxy_port ? `${proxy_ip}:${proxy_port}` : null,
          }]);

        if (logError) {
          console.error('Failed to log task failure:', logError);
        }

        // Update task status
        await supabase
          .from('tasks')
          .update({ status: 'failed' })
          .eq('id', task.id);
      } catch (logError) {
        console.error('Error logging task failure:', logError);
      }
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to add account",
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  } finally {
    if (context) await context.close();
  }
}
