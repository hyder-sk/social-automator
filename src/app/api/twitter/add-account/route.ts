import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { createStealthSetup } from "@/lib/playwright-config";
import { z } from "zod";
import { Page, BrowserContext } from "playwright";
import { generateTOTPCode } from "@/lib/utils";

// Schema for request validation
const addAccountSchema = z.object({
  username: z.string().min(1, "Username is required"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
  proxy_username: z.string().min(1, "Proxy username is required"),
  proxy_password: z.string().min(1, "Proxy password is required"),
  proxy_ip: z.string().min(1, "Proxy IP is required"),
  proxy_port: z.coerce.number().min(1, "Proxy port is required"),
  mail_password: z.string().optional(),
  mfa_code: z.string().optional(),
});

const randomDelay = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

export async function POST(request: NextRequest) {
  let context: BrowserContext | null = null;
  let page: Page | null = null;
  let supabase;
  let session;
  let proxy_ip: string | undefined;
  let proxy_port: number | undefined;
  let task: { id: string } | null = null;

  try {
    // Initialize Supabase client with cookie store
    const cookieStore = cookies();
    supabase = await createClient(cookieStore);

    // Verify authentication
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
      proxy_ip: reqProxyIp,
      proxy_port: reqProxyPort,
      proxy_username,
      proxy_password,
      mail_password,
      mfa_code,
    } = addAccountSchema.parse(body);

    proxy_ip = reqProxyIp;
    proxy_port = reqProxyPort;

    // Configure proxy as HTTP explicitly
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

    // Check if account already exists
    const { data: existingAccount, error: dbError } = await supabase
      .from('social_accounts')
      .select('*')
      .eq('email', email)
      .eq('platform', 'twitter')
      .single();

    if (existingAccount) {
      // If account exists and is active, return error
      if (existingAccount.status === 'active') {
        return NextResponse.json({
          success: false,
          message: "Twitter account already exists and is active"
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
          mail_password: mail_password,
          mfa_code: mfa_code,
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
            platform: "twitter",
            type: "manual",
            email,
            password,
            username,
            status: 'pending',
            proxy_ip: proxy_ip,
            proxy_port: proxy_port,
            proxy_username: proxy_username,
            proxy_password: proxy_password,
            mail_password: mail_password,
            mfa_code: mfa_code,
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
      // Step 1: Navigate to Twitter login page
      await page.goto("https://x.com/i/flow/login", {
        waitUntil: "domcontentloaded",
        timeout: 300000,
      });

      // Wait with human-like delay
      await page.waitForTimeout(randomDelay(1000, 3000));

      // Step 2: Wait for and enter username (not email)
      try {
        // Wait for the input to be visible
        await page.waitForSelector('input[autocomplete="username"]', {
          timeout: 300000,
        });

        const usernameInput = await page
          .locator('input[autocomplete="username"]')
          .first();

        // Type with human-like delay between characters
        await usernameInput.fill("");
        for (const char of username) {
          await usernameInput.type(char, { delay: randomDelay(50, 150) });
        }

        await page.waitForTimeout(randomDelay(500, 1000));

        // Find and click Next button
        const nextButton = await page
          .locator('[role="button"]')
          .filter({ hasText: "Next" })
          .first();
        await nextButton.click();

        // Wait for possible redirection to email verification page
        await page.waitForTimeout(randomDelay(1000, 3000));

        // Check if we're on the phone/email verification step
        const emailInputText = await page
          .locator('input[data-testid="ocfEnterTextTextInput"]')
          .count();
        const phoneEmailTitle = await page
          .getByText("Enter your phone number or email address")
          .count();

        if (emailInputText > 0 || phoneEmailTitle > 0) {
          // Try various selectors for the email input field
          let emailInput = null;
          for (const selector of [
            'input[data-testid="ocfEnterTextTextInput"]',
            'input[placeholder="Phone or email"]',
            'input[type="text"]:visible',
          ]) {
            const inputs = await page.locator(selector).all();
            for (const input of inputs) {
              if (await input.isVisible().catch(() => false)) {
                emailInput = input;
                break;
              }
            }
            if (emailInput) break;
          }

          if (emailInput) {
            // Enter EMAIL on the second page
            await emailInput.click();
            await emailInput.fill("");

            // Type email with human-like delay
            for (const char of email) {
              await emailInput.type(char, { delay: randomDelay(50, 150) });
            }

            await page.waitForTimeout(randomDelay(500, 1000));

            // Find and click Next button
            const emailNextButton = await page
              .locator('[role="button"]')
              .filter({ hasText: "Next" })
              .first();
            await emailNextButton.click();
            await page.waitForTimeout(randomDelay(1000, 3000));
          } else {
            console.error("Could not find email input field");
          }
        }
      } catch (error) {
        console.error(
          "Error in username/email step:",
          error instanceof Error ? error.message : String(error)
        );
        throw new Error(
          "Failed in username/email step: " +
            (error instanceof Error ? error.message : String(error))
        );
      }

      // Step 3: Wait for and enter password
      try {
        // Wait for password field to appear (increased timeout)
        await page.waitForSelector('input[name="password"]', {
          timeout: 300000,
        });

        const passwordInput = await page
          .locator('input[name="password"]')
          .first();

        // Type password with human-like delay
        await passwordInput.fill("");
        for (const char of password) {
          await passwordInput.type(char, { delay: randomDelay(50, 150) });
        }

        await page.waitForTimeout(randomDelay(500, 1000));

        // Find and click Log in button
        const loginButton = await page
          .locator('[role="button"]')
          .filter({ hasText: "Log in" })
          .first();
        await loginButton.click();

        // Wait for login to process
        await page.waitForTimeout(randomDelay(2000, 4000));
      } catch (passwordError: unknown) {
        console.error("Error entering password:", passwordError);
        throw new Error(
          "Failed to enter password: " +
            (passwordError instanceof Error
              ? passwordError.message
              : String(passwordError))
        );
      }

      // Step 4: Wait for response and check for MFA
      await page.waitForTimeout(randomDelay(2000, 4000));

      // Check if MFA page appears (look for verification code input)
      const mfaInput = await page
        .locator('input[data-testid="ocfEnterTextTextInput"]')
        .count();
      const mfaTitle = await page
        .getByText("Enter your verification code")
        .count();
      

      if (mfaInput > 0 || mfaTitle > 0) {
        // MFA is required
        if (!mfa_code || mfa_code === "") {
          // No MFA code provided, return error asking for it
          await context.close();
          return NextResponse.json(
            {
              success: false,
              requiresMfa: true,
              message:
                "MFA verification required. Please provide your TOTP secret key.",
            },
            { status: 200 }
          );
        }

        // Generate TOTP code from the provided secret
        const totpCode = generateTOTPCode(mfa_code);

        // Find the input field for MFA code
        const codeInput = await page
          .locator('input[data-testid="ocfEnterTextTextInput"]')
          .first();

        // Enter the verification code
        await codeInput.click({ delay: randomDelay(100, 200) });
        await codeInput.fill("");

        // Type slowly with human-like delay
        for (const char of totpCode) {
          await codeInput.type(char, { delay: randomDelay(100, 200) });
        }

        await page.waitForTimeout(randomDelay(800, 1200));

        // Click Next/Verify button
        let verifyButton = await page
          .locator('[role="button"]')
          .filter({ hasText: "Next" })
          .first();
        if (!(await verifyButton.isVisible().catch(() => false))) {
          verifyButton = await page
            .locator('[role="button"]')
            .filter({ hasText: "Verify" })
            .first();
        }

        if (!(await verifyButton.isVisible().catch(() => false))) {
          throw new Error("Could not find MFA verify button");
        }

        await verifyButton.click();

        // Wait for MFA verification to complete with longer timeout
        await page.waitForTimeout(randomDelay(5000, 8000));

        // Check if we're still on a verification page or need to click Next again
        const stillOnVerificationPage = await page
          .locator('input[data-testid="ocfEnterTextTextInput"]')
          .isVisible()
          .catch(() => false);
        const verificationText = await page
          .getByText("Enter your verification code")
          .isVisible()
          .catch(() => false);

        if (stillOnVerificationPage || verificationText) {
          // Try clicking Next/Verify again
          let nextButton = await page
            .locator('[role="button"]')
            .filter({ hasText: "Next" })
            .first();
          if (!(await nextButton.isVisible().catch(() => false))) {
            nextButton = await page
              .locator('[role="button"]')
              .filter({ hasText: "Verify" })
              .first();
          }

          if (await nextButton.isVisible().catch(() => false)) {
            await nextButton.click();
            await page.waitForTimeout(randomDelay(5000, 8000));
          }
        }
      }

      // Step 5: Check if we're logged in and handle redirect if needed
      let loggedIn = false;
      let retryCount = 0;
      const maxRetries = 5;
      let extractedUsername = "";

      while (!loggedIn && retryCount < maxRetries) {
        // Log current URL to debug redirects
        const currentUrl = page.url();

        // Check for common elements that indicate successful login
        const homeTimeline = await page
          .locator('[data-testid="primaryColumn"]')
          .isVisible()
          .catch(() => false);
        const profileLink = await page
          .locator('[data-testid="AppTabBar_Profile_Link"]')
          .isVisible()
          .catch(() => false);
        const tweetButton = await page
          .locator('[data-testid="tweetButtonInline"]')
          .isVisible()
          .catch(() => false);
        const sideNavHome = await page
          .locator('[data-testid="AppTabBar_Home_Link"]')
          .isVisible()
          .catch(() => false);

        if (
          homeTimeline ||
          profileLink ||
          tweetButton ||
          sideNavHome ||
          currentUrl.includes("/home")
        ) {
          loggedIn = true;

          // Try to get username from various sources
          try {
            // Try from profile link
            const profileLinkElement = await page
              .locator('[data-testid="AppTabBar_Profile_Link"]')
              .first();
            const href = await profileLinkElement
              .getAttribute("href")
              .catch(() => null);
            if (href) {
              extractedUsername = href.replace("/", "");
            }
            // If profile link method fails, try alternate methods
            else {
              // Try from logged-in account popup
              await page
                .click('[data-testid="SideNav_AccountSwitcher_Button"]')
                .catch(() => null);
              await page.waitForTimeout(randomDelay(1000, 2000));
              const accountUsername = await page
                .locator('[data-testid="UserCell-contents"] [dir="ltr"]')
                .first()
                .textContent()
                .catch(() => null);
              if (accountUsername) {
                extractedUsername = accountUsername.replace("@", "");
              } else {
                // Last resort - use the username from input
                extractedUsername = username;
              }

            }
          } catch (usernameError) {
            console.error("Error getting username:", usernameError);
            // Fallback to provided username
            extractedUsername = username;
          }

          break;
        }
        // Not logged in - check if we're back at login page
        else {
          // Check for various alternative pages
          const loginForm = await page
            .locator('input[autocomplete="username"]')
            .isVisible()
            .catch(() => false);
          const confirmationPage = await page
            .getByText("We sent you a confirmation code")
            .isVisible()
            .catch(() => false);
          const securityPage = await page
            .getByText("Confirm your identity")
            .isVisible()
            .catch(() => false);

          if (loginForm) {
            // Try navigating to home directly
            await page.goto("https://x.com/home", {
              waitUntil: "domcontentloaded",
              timeout: 30000,
            });
            await page.waitForTimeout(randomDelay(5000, 8000));
          } else if (confirmationPage || securityPage) {
            // We can consider this "logged in enough" to save the account
            loggedIn = true;
            extractedUsername = username;
            break;
          }
        }

        retryCount++;
        await page.waitForTimeout(randomDelay(3000, 5000));
      }

      // Even if login verification fails, let's still save the account with what we have
      const cookies = await context.cookies();
      const cookiesString = JSON.stringify(cookies);

      if (!loggedIn) {
        console.warn(
          "Could not verify successful login after multiple attempts, but will save account anyway"
        );
        // We'll continue to save the account instead of throwing an error
      }

      try {
        // Store account in database
        let account;
        let accountError;

        if (existingAccount && existingAccount.status === 'pending') {
          // Update existing pending account
          const { data: updatedAccount, error: updateError } = await supabase
            .from("social_accounts")
            .update({
              username: extractedUsername || username,
              cookies: cookiesString,
              status: loggedIn ? "active" : "pending",
              proxy_ip: proxy_ip,
              proxy_port: proxy_port,
              proxy_username: proxy_username,
              proxy_password: proxy_password,
              mail_password: mail_password,
              mfa_code: mfa_code,
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
                platform: "twitter",
                type: "manual",
                email,
                password,
                username: extractedUsername || username,
                cookies: cookiesString,
                status: loggedIn ? "active" : "pending",
                proxy_ip: proxy_ip,
                proxy_port: proxy_port,
                proxy_username: proxy_username,
                proxy_password: proxy_password,
                mail_password: mail_password,
                mfa_code: mfa_code,
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
            .eq('platform', 'twitter')
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
