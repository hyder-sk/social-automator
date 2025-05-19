import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { createStealthSetup } from '@/lib/playwright-config';
import { z } from 'zod';
import { Page, BrowserContext } from 'playwright';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

// Schema for request validation
const createPostSchema = z.object({
  content: z.string().min(1, 'Content is required').max(280, 'Tweet cannot exceed 280 characters'),
  accountId: z.string().uuid('Invalid account ID')
});

// Helper function for random delays to simulate human behavior
const randomDelay = (min: number, max: number) => 
  Math.floor(Math.random() * (max - min + 1)) + min;

export async function POST(request: NextRequest) {
  let context: BrowserContext | null = null;
  let page: Page | null = null;
  const tempFiles: string[] = [];

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

    // Parse form data
    const formData = await request.formData();
    const content = formData.get('content') as string;
    const accountId = formData.get('accountId') as string;

    // Validate required fields
    const { content: validatedContent, accountId: validatedAccountId } = createPostSchema.parse({
      content,
      accountId,
    });

    // Get account details from database
    const { data: account, error: accountError } = await supabase
      .from('social_accounts')
      .select('*')
      .eq('id', validatedAccountId)
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
      social_account_id: validatedAccountId,
      type: 'post',
      action_data: {
        content: validatedContent,
        media_count: 0,
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

    // Handle media files
    const mediaFiles: { path: string; type: string }[] = [];
    for (let i = 0; formData.has(`media${i}`); i++) {
      const file = formData.get(`media${i}`) as File;
      if (!file) continue;

      // Save file to temp directory
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const tempPath = join(tmpdir(), `twitter-media-${task.id}-${i}-${file.name}`);
      await writeFile(tempPath, buffer);
      tempFiles.push(tempPath);

      mediaFiles.push({
        path: tempPath,
        type: file.type.startsWith('image/') ? 'image' : 'video'
      });
    }

    // Update task with media count
    await supabase
      .from('tasks')
      .update({
        action_data: {
          ...taskData.action_data,
          media_count: mediaFiles.length,
        }
      })
      .eq('id', task.id);

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
      // Navigate to Twitter
      await page.goto('https://x.com/home', {
        waitUntil: 'domcontentloaded',
        timeout: 60000 // Increased timeout
      });

      // Wait for the page to load with random delay (more human-like)
      await page.waitForTimeout(randomDelay(2000, 4000));

      // Check if we're logged in by looking for tweet compose box
      const isLoggedIn = await page.locator('[data-testid="tweetTextarea_0"]').isVisible().catch(() => false);
      
      if (!isLoggedIn) {
        
        const currentUrl = page.url();
        
        // If we're on login page, try to restore session
        if (currentUrl.includes('/login') || currentUrl.includes('/i/flow/login')) {
          
          // Try to restore cookies
          if (account.cookies) {
            try {
              const cookies = JSON.parse(account.cookies);
              await context.addCookies(cookies);
              
              // Navigate to home again
              await page.goto('https://x.com/home', {
                waitUntil: 'domcontentloaded',
                timeout: 60000
              });
              
              // Wait and check if we're logged in now
              await page.waitForTimeout(randomDelay(3000, 5000));
              const stillNotLoggedIn = await page.locator('[data-testid="tweetTextarea_0"]').isVisible().catch(() => false);
              
              if (!stillNotLoggedIn) {
                // Update account status to indicate session needs refresh
                await supabase
                  .from('social_accounts')
                  .update({ status: 'session_expired' })
                  .eq('id', validatedAccountId);
                
                throw new Error('Session expired and could not be restored - please re-login to this account');
              }
            } catch (cookieError) {
              console.error("Error restoring cookies:", cookieError);
              throw new Error('Failed to restore session - please re-login to this account');
            }
          } else {
            throw new Error('No cookies available to restore session - please re-login to this account');
          }
        }
      }
      await page.waitForSelector('[data-testid="tweetTextarea_0"]', { timeout: 30000 });
      const tweetTextarea = await page.locator('[data-testid="tweetTextarea_0"]').first();
      
      // Click the textarea with human-like delay
      await tweetTextarea.click({ delay: randomDelay(50, 150) });
      await page.waitForTimeout(randomDelay(500, 1000));
      
      // Type content with human-like typing speed
      for (const char of validatedContent) {
        await page.keyboard.type(char, { delay: randomDelay(30, 100) });
      }
      
      // Random pause after typing
      await page.waitForTimeout(randomDelay(800, 1500));

      // Upload media files if any
      if (mediaFiles.length > 0) {
        // Click the media upload button
        const mediaButton = await page.waitForSelector('[data-testid="fileInput"]');
        if (!mediaButton) {
          throw new Error('Could not find media upload button');
        }

        // Upload each media file
        for (const media of mediaFiles) {
          try {
            // Set input files
            await mediaButton.setInputFiles(media.path);

            // Wait for media preview to appear
            await page.waitForSelector('[data-testid="attachments"]', { timeout: 10000 });

            // Wait between uploads
            await page.waitForTimeout(randomDelay(1000, 2000));
          } catch (uploadError: any) {
            console.error(`Error uploading ${media.type}:`, uploadError);
            throw new Error(`Failed to upload ${media.type}: ${uploadError.message}`);
          }
        }
      }

      await page.waitForSelector('[data-testid="tweetButtonInline"]', { timeout: 30000 });
      const postButton = await page.locator('[data-testid="tweetButtonInline"]').first();
      
      // Check if button is enabled
      const isDisabled = await postButton.isDisabled().catch(() => true);
      if (isDisabled) {
        throw new Error('Post button is disabled, cannot create tweet');
      }

      // Click the post button with human-like delay
      await postButton.click({ delay: randomDelay(50, 150) });

      // Wait for the post to be created
      await page.waitForTimeout(randomDelay(4000, 6000));

      // Look for success indicators
      const viewTweet = await page.getByText('View').isVisible().catch(() => false);
      const postAgain = await page.getByText('Post another Tweet').isVisible().catch(() => false);
      const successToast = await page.locator('[data-testid="toast"]').textContent().catch(() => null);
      
      // Check if the toast message is actually a success message
      if (successToast && successToast.includes('Your post was sent')) {
        console.log('Tweet posted successfully:', successToast);
      } else if (!viewTweet && !postAgain && successToast) {
        // Only throw error if we don't see success indicators and have a non-success toast
        throw new Error(`Twitter returned error: ${successToast}`);
      }

      // Log success to task_logs
      await supabase
        .from('task_logs')
        .insert([{
          task_id: task.id,
          execution_time: new Date().toISOString(),
          result: 'success',
          message: 'Tweet created successfully',
        }]);

      // Update task status
      await supabase
        .from('tasks')
        .update({ status: 'completed' })
        .eq('id', task.id);

      return NextResponse.json({ 
        success: true,
        message: 'Tweet created successfully',
        taskId: task.id 
      });

    } catch (error) {
      console.error('Error in post creation:', error);
      
      // Log failure to task_logs
      await supabase
        .from('task_logs')
        .insert([{
          task_id: task.id,
          execution_time: new Date().toISOString(),
          result: 'failed',
          message: error instanceof Error ? error.message : 'Failed to create tweet',
        }]);

      // Update task status
      await supabase
        .from('tasks')
        .update({ status: 'failed' })
        .eq('id', task.id);

      throw error;
    } finally {
      // Clean up temp files
      for (const file of tempFiles) {
        try {
          await writeFile(file, ''); // Clear file content
        } catch (error) {
          console.error('Error cleaning up temp file:', error);
        }
      }

      if (context) await context.close();
    }

  } catch (error) {
    console.error('Error creating tweet:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to create tweet',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
} 