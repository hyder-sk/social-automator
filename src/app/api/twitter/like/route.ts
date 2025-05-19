import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { createStealthSetup } from '@/lib/playwright-config';
import { z } from 'zod';
import { Page, BrowserContext } from 'playwright';

// Schema for request validation
const likeTweetSchema = z.object({
  tweetUrl: z.string().url('Invalid tweet URL'),
  accountId: z.string().uuid('Invalid account ID')
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
    const { tweetUrl, accountId } = likeTweetSchema.parse(body);

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
      type: 'like',
      action_data: {
        tweet_url: tweetUrl,
        action_type: 'like',
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
      // Navigate to the tweet URL
      await page.goto(tweetUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });

      // Wait for the page to load with random delay
      await page.waitForTimeout(randomDelay(2000, 4000));


      // Check if post is already liked
      const isAlreadyLiked = await page.locator('[data-testid="unlike"]').isVisible().catch(() => false);
      
      if (isAlreadyLiked) {
        // Log success since post is already liked
        await supabase
          .from('task_logs')
          .insert([{
            task_id: task.id,
            execution_time: new Date().toISOString(),
            result: 'success',
            message: 'Post was already liked',
          }]);

        // Update task status
        await supabase
          .from('tasks')
          .update({ status: 'completed' })
          .eq('id', task.id);

        return NextResponse.json({ 
          success: true,
          message: 'Post was already liked',
          taskId: task.id 
        });
      }

      // If not already liked, proceed with liking
      const likeButton = await page.waitForSelector('[data-testid="like"]', { timeout: 30000 });
      
      // Get initial like count if available
      const initialLikeCount = await page.locator('[data-testid="like"] span[data-testid="app-text-transition-container"]')
        .textContent()
        .catch(() => null);
      
      await likeButton.click();
      
      // Wait longer for the like animation and state change
      await page.waitForTimeout(randomDelay(2000, 3000));

      // Verify the like action with retry logic
      let likeVerified = false;
      let retryCount = 0;
      const maxRetries = 3;

      while (retryCount < maxRetries && !likeVerified) {
        // Try multiple verification methods
        const verifications = await Promise.all([
          // Check for unlike button - using first() to handle multiple matches
          page.locator('[data-testid="unlike"]').first().isVisible(),
          // Check for unlike button with aria-label - using first() to handle multiple matches
          page.locator('button[aria-label*="Unlike"]').first().isVisible(),
          // Check for unlike button with role - using first() to handle multiple matches
          page.locator('div[role="button"][aria-label*="Unlike"]').first().isVisible(),
          // Check if like count increased (if we had initial count)
          initialLikeCount ? page.locator('[data-testid="like"] span[data-testid="app-text-transition-container"]')
            .first()
            .textContent()
            .then(newCount => newCount !== initialLikeCount)
            .catch(() => false) : false
        ]);

        likeVerified = verifications.some(result => result === true);

        if (!likeVerified && retryCount < maxRetries - 1) {
          retryCount++;
          await page.waitForTimeout(randomDelay(1000, 2000));
        } else {
          break;
        }
      }

      if (!likeVerified) {
        throw new Error('Failed to verify like action after multiple attempts');
      }

      // Additional wait after successful verification
      await page.waitForTimeout(randomDelay(1000, 2000));

      // Log success to task_logs
      await supabase
        .from('task_logs')
        .insert([{
          task_id: task.id,
          execution_time: new Date().toISOString(),
          result: 'success',
          message: 'Tweet liked successfully',
        }]);

      // Update task status
      await supabase
        .from('tasks')
        .update({ status: 'completed' })
        .eq('id', task.id);

      return NextResponse.json({
        success: true,
        message: 'Tweet liked successfully',
        taskId: task.id
      });

    } catch (error) {
      console.error('Error liking tweet:', error);
      
      // Log failure to task_logs
      await supabase
        .from('task_logs')
        .insert([{
          task_id: task.id,
          execution_time: new Date().toISOString(),
          result: 'failed',
          message: error instanceof Error ? error.message : 'Failed to like tweet',
        }]);

      // Update task status
      await supabase
        .from('tasks')
        .update({ status: 'failed' })
        .eq('id', task.id);

      throw error;
    }

  } catch (error) {
    console.error('Error liking tweet:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to like tweet',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  } finally {
    if (context) await context.close();
  }
} 