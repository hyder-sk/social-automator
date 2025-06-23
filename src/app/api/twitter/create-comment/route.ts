import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { createStealthSetup } from '@/lib/playwright-config';
import { z } from 'zod';
import { Page, BrowserContext } from 'playwright';
import { HttpsProxyAgent } from 'https-proxy-agent';

// Schema for request validation
const createCommentSchema = z.object({
  comment: z.string().min(1, 'Comment is required').max(280, 'Comment cannot exceed 280 characters'),
  targetTweet: z.string().url('Invalid tweet URL'),
  accountId: z.string().uuid('Invalid account ID'),
  scheduleType: z.enum(['once', 'repeating', 'interval']),
  scheduleData: z.object({
    interval: z.number().min(1).optional(),
    repeatType: z.enum(['daily', 'weekly']).optional(),
    repeatTime: z.string().optional(),
  }),
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

    // Parse request body
    const body = await request.json();
    const { comment, targetTweet, accountId, scheduleType, scheduleData } = createCommentSchema.parse(body);

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
      type: 'comment',
      action_data: {
        comment,
        targetTweet,
      },
      schedule_type: scheduleType,
      schedule_data: scheduleData,
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
      return NextResponse.json(
        { error: 'Failed to create task', details: 'Could not create the automation task' },
        { status: 500 }
      );
    }

    // If it's a one-time task, execute it immediately
    if (scheduleType === 'once') {
      // Configure proxy with HTTP protocol
      const proxyConfig = account.proxy_ip && account.proxy_port ? {
        type: 'http',
        server: account.proxy_ip,
        port: account.proxy_port,
        username: account.proxy_username || '',
        password: account.proxy_password || ''
      } : undefined;

      // Validate proxy configuration if provided
      if (proxyConfig) {
        try {
          const proxyUrl = `http://${proxyConfig.username}:${proxyConfig.password}@${proxyConfig.server}:${proxyConfig.port}`;
          const proxyAgent = new HttpsProxyAgent(proxyUrl);
          
          const testResponse = await fetch('https://api.ipify.org?format=json', {
            // @ts-ignore - HttpsProxyAgent is compatible with fetch
            agent: proxyAgent,
            timeout: 10000
          });
          if (!testResponse.ok) {
            throw new Error('Proxy validation failed');
          }
        } catch (error) {
          console.error('Proxy validation error:', error);
          // Log proxy validation failure
          await supabase
            .from('task_logs')
            .insert([{
              task_id: task.id,
              execution_time: new Date().toISOString(),
              result: 'failed',
              message: 'Proxy validation failed: ' + (error instanceof Error ? error.message : 'Unknown error'),
              proxy_used: `${account.proxy_ip}:${account.proxy_port}`
            }]);

          // Update task status
          await supabase
            .from('tasks')
            .update({ status: 'failed' })
            .eq('id', task.id);

          return NextResponse.json(
            { error: 'Proxy validation failed', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
          );
        }
      }

      // Create browser with stealth configuration and proxy
      const { context: newContext, page: newPage } = await createStealthSetup(account.cookies, proxyConfig);
      context = newContext;
      page = newPage;

      if (!page) {
        throw new Error('Failed to create new page');
      }

      try {
        // Implement retry logic for page navigation
        let retryCount = 0;
        const maxRetries = 3;
        let lastError: Error | null = null;

        while (retryCount < maxRetries) {
          try {
            // Navigate to the tweet URL
            await page.goto(targetTweet, {
              waitUntil: 'domcontentloaded',
              timeout: 300000 // 5 minutes timeout
            });
            break; // If successful, break the retry loop
          } catch (error) {
            lastError = error instanceof Error ? error : new Error('Unknown error during navigation');
            console.error(`Navigation attempt ${retryCount + 1} failed:`, lastError);
            
            if (retryCount < maxRetries - 1) {
              // Wait before retrying with exponential backoff
              await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
              retryCount++;
            } else {
              throw lastError;
            }
          }
        }

        // Wait for the page to load with random delay
        await page.waitForTimeout(randomDelay(2000, 4000));

        // Wait for the reply button and click it
        const replyButton = await page.waitForSelector('div[class*="r-xoduu5"] svg[viewBox="0 0 24 24"]', { timeout: 300000 }); // Increased from 30000 to 300000
        await replyButton.click();
        await page.waitForTimeout(randomDelay(1000, 2000));

        // Wait for the reply dialog and textarea
        const replyTextarea = await page.waitForSelector('div[data-offset-key]', { timeout: 30000 });
        
        // Remove any blocking overlays and wait for them to be gone
        await page.evaluate(() => {
          const masks = document.querySelectorAll('[data-testid="mask"], [data-testid="twc-cc-mask"]');
          masks.forEach(mask => mask.remove());
        });
        
        // Wait a bit for the masks to be fully removed
        await page.waitForTimeout(1000);
        
        // Try to focus the textarea instead of clicking
        await page.evaluate(() => {
          const textarea = document.querySelector('div[data-offset-key]') as HTMLElement;
          if (textarea) {
            textarea.focus();
          }
        });
        
        await page.waitForTimeout(randomDelay(500, 1000));

        // Type comment with human-like typing speed
        for (const char of comment) {
          await page.keyboard.type(char, { delay: randomDelay(30, 100) });
        }

        // Random pause after typing
        await page.waitForTimeout(randomDelay(800, 1500));

        // Click the Reply button using data-testid
        const submitButton = await page.waitForSelector('button[data-testid="tweetButton"]', { timeout: 30000 });
        
        // Remove any masks again before clicking the button
        await page.evaluate(() => {
          const masks = document.querySelectorAll('[data-testid="mask"], [data-testid="twc-cc-mask"]');
          masks.forEach(mask => mask.remove());
        });
        
       // await page.waitForTimeout(1000);
        await submitButton.click();

        // Wait for the reply to be posted
        await page.waitForTimeout(randomDelay(4000, 6000));

        // Log success to task_logs
        await supabase
          .from('task_logs')
          .insert([{
            task_id: task.id,
            execution_time: new Date().toISOString(),
            result: 'success',
            message: 'Reply posted successfully',
            proxy_used: account.proxy_ip && account.proxy_port ? 
              `${account.proxy_ip}:${account.proxy_port}` : null
          }]);

        // Update task status
        await supabase
          .from('tasks')
          .update({ status: 'completed' })
          .eq('id', task.id);

      } catch (error) {
        console.error('Error posting reply:', error);
        
        // Log failure to task_logs
        await supabase
          .from('task_logs')
          .insert([{
            task_id: task.id,
            execution_time: new Date().toISOString(),
            result: 'failed',
            message: error instanceof Error ? error.message : 'Failed to post reply',
            proxy_used: account.proxy_ip && account.proxy_port ? 
              `${account.proxy_ip}:${account.proxy_port}` : null
          }]);

        // Update task status
        await supabase
          .from('tasks')
          .update({ status: 'failed' })
          .eq('id', task.id);

        throw error;
      }
    }

    return NextResponse.json({ 
      success: true,
      message: 'Comment task created successfully',
      taskId: task.id 
    });

  } catch (error) {
    console.error('Error creating comment task:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to create comment task',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  } finally {
    if (context) await context.close();
  }
} 