import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { createStealthSetup } from '@/lib/playwright-config';
import { z } from 'zod';
import { Page, BrowserContext } from 'playwright';

// Schema for request validation
const followUserSchema = z.object({
  targetUrl: z.string().min(1, 'Target URL is required'),
  accountId: z.string().uuid('Invalid account ID'),
  action: z.string().min(1, 'Action is required')
});

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
    const { targetUrl, accountId, action } = followUserSchema.parse(body);

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
        profile_url: targetUrl,
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

    // Configure proxy if available
    const proxyConfig = account.proxy_ip && account.proxy_port ? {
      type: 'http' as const,
      server: account.proxy_ip,
      port: account.proxy_port.toString(),
      username: account.proxy_username || "",
      password: account.proxy_password || "",
    } : undefined;

    // Create browser with stealth configuration and proxy
    const { context: newContext, page: newPage } = await createStealthSetup(account.cookies, proxyConfig);
    context = newContext;
    page = newPage;

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
      // Navigate to Facebook
      await page.goto('https://www.facebook.com/', {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });

      // Wait for the page to load
      await page.waitForTimeout(3000);

      // Navigate to target page
      await page.goto(targetUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });

      // Wait for the page to load
      await page.waitForTimeout(3000);

      if (action === 'follow') {
          // If direct button not found, use the "..." menu flow
          const moreButton = await page.locator('div[role="none"] svg[viewBox="0 0 24 24"]').first();
          if (!moreButton) {
            throw new Error('Could not find "..." button');
          }

          // Click the more button
          await moreButton.click();

          // Wait for the dropdown menu to appear
          await page.waitForTimeout(1000);

          // Then find and click the Follow button in the dropdown using the exact structure
          const followButton = await page.locator('div[role="menuitem"] span[dir="auto"]:has-text("Follow")').first();
          if (!followButton) {
            throw new Error('Could not find Follow button in dropdown');
          }

          // Click the follow button
          await followButton.click();
          // Wait a bit for the action to register
          await page.waitForTimeout(2000);
          // Reload the page
          await page.reload({ waitUntil: 'domcontentloaded' });
        //}
      } else if (action === 'unfollow') {
        // Find and click the "Following" button
        const followingButton = await page.locator('div[role="button"]').filter({ hasText: 'Following' }).first();
        if (!followingButton) {
          throw new Error('Could not find Following button');
        }

        // Click the Following button to open dialog
        await followingButton.click();

        // Wait for the dialog to appear
        await page.waitForTimeout(1000);

        // Wait for the "Follow settings" dialog
        const dialogTitle = await page.locator('div[role="dialog"]').filter({ hasText: 'Follow settings' }).first();
        if (!dialogTitle) {
          throw new Error('Could not find Follow settings dialog');
        }

        // Find and click the "Unfollow" radio button
        const unfollowRadio = await page.locator('div[role="radio"]').filter({ hasText: 'Unfollow' }).first();
        if (!unfollowRadio) {
          throw new Error('Could not find Unfollow radio button');
        }

        // Click the Unfollow radio button
        await unfollowRadio.click();

        // Find and click the Update button
        const updateButton = await page.locator('div[role="button"]').filter({ hasText: 'Update' }).first();
        if (!updateButton) {
          throw new Error('Could not find Update button');
        }

        // Click the Update button to confirm unfollow
        await updateButton.click();

        // Wait for the action to complete
        await page.waitForTimeout(2000);
        // Reload the page
        await page.reload({ waitUntil: 'domcontentloaded' });
      }

      // Wait for the action to complete
      await page.waitForTimeout(3000);

      // Log success to task_logs
      await supabase
        .from('task_logs')
        .insert([{
          task_id: task.id,
          execution_time: new Date().toISOString(),
          result: 'success',
          message: `Successfully ${action}ed page`,
        }]);

      // Update task status
      await supabase
        .from('tasks')
        .update({ status: 'completed' })
        .eq('id', task.id);

      return NextResponse.json({
        success: true,
        message: `Successfully ${action}ed page`,
        taskId: task.id
      });

    } catch (error) {
      // Log failure to task_logs
      await supabase
        .from('task_logs')
        .insert([{
          task_id: task.id,
          execution_time: new Date().toISOString(),
          result: 'failed',
          message: error instanceof Error ? error.message : `Failed to ${action} page`,
        }]);

      // Update task status
      await supabase
        .from('tasks')
        .update({ status: 'failed' })
        .eq('id', task.id);

      throw error;
    }

  } catch (error) {
    console.error('Error following user:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to follow user',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  } finally {
    if (context) await context.close();
  }
}