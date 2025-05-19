import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { createStealthSetup } from '@/lib/playwright-config';
import { z } from 'zod';
import { Page, BrowserContext } from 'playwright';

// Schema for request validation
const followUserSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  accountId: z.string().uuid('Invalid account ID'),
  action: z.enum(['follow', 'unfollow']).default('follow')
});

// Helper function for random delays to simulate human behavior
const randomDelay = (min: number, max: number) => 
  Math.floor(Math.random() * (max - min + 1)) + min;

export async function POST(request: NextRequest) {
  let context: BrowserContext | null = null;
  let page: Page | null = null;

  try {
    // Initialize Supabase client with cookie store
    const cookieStore = cookies();
    const supabase = await createClient(cookieStore);

    // Verify authentication
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const { username, accountId, action } = followUserSchema.parse(body);

    // Get account details from database
    const { data: account, error: accountError } = await supabase
      .from('social_accounts')
      .select('*')
      .eq('id', accountId)
      .eq('user_id', session.user.id)
      .single();

    if (accountError || !account) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      );
    }

    // Create task data
    const taskData = {
      user_id: session.user.id,
      social_account_id: accountId,
      type: action,
      action_data: {
        username,
        action_type: action,
      },
      schedule_type: 'once',
      schedule_data: {},
      status: 'active',
      next_run_at: new Date().toISOString(),
    };

    // Insert task into database
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .insert([taskData])
      .select()
      .single();

    if (taskError) {
      console.error('Task creation error:', taskError);
      return NextResponse.json(
        { error: 'Failed to create task', details: 'Could not create the automation task' },
        { status: 500 }
      );
    }

    // Configure proxy with HTTP protocol
    const proxyConfig = account.proxy_ip && account.proxy_port ? {
      type: 'http',
      server: account.proxy_ip,
      port: account.proxy_port,
      username: account.proxy_username || '',
      password: account.proxy_password || ''
    } : undefined;

    // Create browser with stealth configuration and proxy
    const { context: newContext, page: newPage } = await createStealthSetup(account.cookies, proxyConfig);
    context = newContext;
    page  = newPage;

    if (!page) {
      // Log failure to task_logs
      await supabase
        .from('task_logs')
        .insert([{
          task_id: task.id,
          execution_time: new Date().toISOString(),
          result: 'failed',
          message: 'Failed to create new page',
        }]);

      // Update task status
      await supabase
        .from('tasks')
        .update({ status: 'failed' })
        .eq('id', task.id);

      throw new Error('Failed to create new page');
    }

    try {
      // Navigate to user's profile
      const profileUrl = `https://x.com/${username}`;
      await page.goto(profileUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });

      // Wait for the page to load with random delay
      await page.waitForTimeout(randomDelay(2000, 4000));

      // Check current follow state
      const isFollowing = await page.evaluate(() => {
        const followingButton = document.querySelector('[data-testid$="-unfollow"]');
        const followButton = document.querySelector('[data-testid$="-follow"]');
        return {
          isFollowing: followingButton !== null,
          isNotFollowing: followButton !== null
        };
      });

      // Handle edge cases
      if (action === 'follow' && isFollowing.isFollowing) {
        await supabase
          .from('task_logs')
          .insert([{
            task_id: task.id,
            execution_time: new Date().toISOString(),
            result: 'success',
            message: 'User is already being followed'
          }]);
        
        return NextResponse.json({ 
          success: true,
          message: 'User is already being followed',
          taskId: task.id 
        });
      }

      if (action === 'unfollow' && isFollowing.isNotFollowing) {
        await supabase
          .from('task_logs')
          .insert([{
            task_id: task.id,
            execution_time: new Date().toISOString(),
            result: 'success',
            message: 'User is not being followed'
          }]);
        
        return NextResponse.json({ 
          success: true,
          message: 'User is not being followed',
          taskId: task.id 
        });
      }

      // Define selectors based on action
      const buttonSelectors = action === 'follow' ? [
        '[data-testid$="-follow"]',
        'button[aria-label="Follow @rihanna"]',
        'button[aria-label*="Follow"]',
        '[data-testid="placementTracking"] button[aria-label*="Follow"]'
      ] : [
        '[data-testid$="-unfollow"]',
        'button[aria-label="Following @rihanna"]',
        'button[aria-label*="Following"]',
        '[data-testid="placementTracking"] button[aria-label*="Following"]'
      ];

      let actionButton = null;
      let retryCount = 0;
      const maxRetries = 3;

      while (retryCount < maxRetries && !actionButton) {
        try {
          if (!page) {
            throw new Error('Page is null - browser context may have been closed');
          }
          
          // Wait for any of the selectors to be visible
          await Promise.race(
            buttonSelectors.map(selector =>
              page && page.waitForSelector(selector, { timeout: 10000 })
            )
          );

          // Try each selector
          for (const selector of buttonSelectors) {
            const button = await page.locator(selector).first();
            if (await button.isVisible()) {
              actionButton = button;
              break;
            }
          }

          if (actionButton) break;

        } catch (error) {
          retryCount++;
          
          if (retryCount < maxRetries && page) {
            try {
              
              // Wait before retrying
              await page.waitForTimeout(randomDelay(2000, 4000));
              
              // Try refreshing the page
              await page.reload({ waitUntil: 'domcontentloaded' });
              await page.waitForTimeout(randomDelay(2000, 4000));
            } catch (retryError) {
              console.error('Error during retry:', retryError);
              // If we can't interact with the page, break the retry loop
              break;
            }
          }
        }
      }

      if (!actionButton) {
        // If we can't find the action button, check if it's because we're trying to unfollow someone we don't follow
        if (action === 'unfollow') {
          await supabase
            .from('task_logs')
            .insert([{
              task_id: task.id,
              execution_time: new Date().toISOString(),
              result: 'success',
              message: 'User is not being followed'
            }]);

          // Update task status
          await supabase
            .from('tasks')
            .update({ status: 'completed' })
            .eq('id', task.id);

          return NextResponse.json({ 
            success: true,
            message: 'User is not being followed',
            taskId: task.id 
          });
        }

        // For follow action, it's a real error
        throw new Error(`Could not find ${action} button after multiple attempts`);
      }

      // Click the button with human-like delay
      await actionButton.click({ delay: randomDelay(50, 150) });

      // Handle unfollow confirmation dialog
      if (action === 'unfollow') {
        // Wait for confirmation dialog
        await page.waitForSelector('[data-testid="confirmationSheetConfirm"]', { timeout: 5000 });
        
        // Click the Unfollow button in the confirmation dialog
        await page.click('[data-testid="confirmationSheetConfirm"]');
        
        // Wait for dialog to close
        await page.waitForTimeout(randomDelay(1000, 2000));
      }

      // Wait for action to complete
      await page.waitForTimeout(randomDelay(2000, 4000));


      // // Verify the action was successful
      // const verifySelectors = action === 'follow' ? [
      //   '[data-testid$="-unfollow"]',
      //   'button[aria-label="Following @rihanna"]',
      //   'button[aria-label*="Following"]'
      // ] : [
      //   '[data-testid$="-follow"]',
      //   'button[aria-label="Follow @rihanna"]',
      //   'button[aria-label*="Follow"]'
      // ];

      // let isActionSuccessful = false;
      // for (const selector of verifySelectors) {
      //   try {
      //     const button = await page.locator(selector).first();
      //     if (await button.isVisible()) {
      //       const buttonText = await button.textContent();
      //       if (action === 'follow' ? buttonText?.includes('Following') : buttonText?.includes('Follow')) {
      //         isActionSuccessful = true;
      //         break;
      //       }
      //     }
      //   } catch (error) {
      //     console.error(`Selector ${selector} not found, trying next...`);
      //   }
      // }

      // if (!isActionSuccessful) {
      //   throw new Error(`Failed to verify ${action} action - could not find expected button state`);
      // }

      // Log success to task_logs
      await supabase
        .from('task_logs')
        .insert([{
          task_id: task.id,
          execution_time: new Date().toISOString(),
          result: 'success',
          message: `User ${action}ed successfully`,
        }]);

      // Update task status
      await supabase
        .from('tasks')
        .update({ status: 'completed' })
        .eq('id', task.id);

      return NextResponse.json({ 
        success: true,
        message: `User ${action}ed successfully`,
        taskId: task.id 
      });

    } catch (error) {
      console.error('Error:', error);
      
      // Log failure to task_logs
      await supabase
        .from('task_logs')
        .insert([{
          task_id: task.id,
          execution_time: new Date().toISOString(),
          result: 'failed',
          message: error instanceof Error ? error.message : `Failed to ${action} user`,
        }]);

      // Update task status
      await supabase
        .from('tasks')
        .update({ status: 'failed' })
        .eq('id', task.id);

      throw error;
    } finally {
      if (context) await context.close();
    }

  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to process request',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
} 