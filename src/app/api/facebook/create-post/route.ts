import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { createStealthSetup, cleanup } from "@/lib/playwright-config";
import { Page, BrowserContext } from "playwright";
import { writeFile } from "fs/promises";
import { join } from "path";
import { v4 as uuidv4 } from "uuid";

interface MediaFile {
  filename: string;
  data: string;
}

interface Task {
  id: string;
  user_id: string;
  social_account_id: string;
  social_account: {
    username: string;
  };
  type: string;
  action_data: {
    content: string;
    media_path: string | null;
    media_type: string | null;
    media?: MediaFile[];
  };
  schedule_type: string;
  schedule_data: any;
  status: string;
  next_run_at: string;
}

export async function POST(request: NextRequest) {
  try {
    // Initialize Supabase client with cookie store
    const cookieStore = cookies();
    const supabase = await createClient(cookieStore);

    // Verify authentication
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse form data
    const formData = await request.formData();
    const accountId = formData.get("accountId") as string;
    const content = formData.get("content") as string;
    const scheduleType = formData.get("scheduleType") as string;
    const scheduleTime = formData.get("scheduleTime") as string;
    const media = formData.get("media") as File | null;
    const mediaType = formData.get("mediaType") as string | null;

    // Validate required fields
    if (!accountId || !content) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Get account details from database
    const { data: account, error: accountError } = await supabase
      .from("social_accounts")
      .select("*")
      .eq("id", accountId)
      .eq("user_id", session.user.id)
      .single();

    if (accountError || !account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    // Handle media upload if present
    let mediaPath = null;
    if (media) {
      const bytes = await media.arrayBuffer();
      const buffer = Buffer.from(bytes);

      // Create unique filename
      const fileExtension = media.name.split(".").pop();
      const fileName = `${uuidv4()}.${fileExtension}`;

      // Save to uploads directory
      const uploadsDir = join(process.cwd(), "uploads");
      mediaPath = join(uploadsDir, fileName);
      await writeFile(mediaPath, buffer);
    }

    // Create task data
    const taskData = {
      user_id: session.user.id,
      social_account_id: accountId,
      type: "post" as const,
      action_data: {
        content,
        media_path: mediaPath,
        media_type: mediaType,
      },
      schedule_type:
        scheduleType === "now" ? ("once" as const) : ("scheduled" as const),
      schedule_data:
        scheduleType === "now"
          ? {}
          : {
              scheduled_time: scheduleTime,
            },
      status: "active" as const,
      next_run_at:
        scheduleType === "now" ? new Date().toISOString() : scheduleTime,
    };

    // Insert task into database
    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .insert([taskData])
      .select()
      .single();

    if (taskError) {
      console.error("Task creation error:", taskError);
      return NextResponse.json(
        {
          error: "Failed to create task",
          details: "Could not create the automation task",
        },
        { status: 500 }
      );
    }

    // Then fetch the social account data
    const { data: socialAccount, error: socialAccountError } = await supabase
      .from("social_accounts")
      .select("username")
      .eq("id", accountId)
      .single();

    if (socialAccountError) {
      console.error("Error fetching social account:", socialAccountError);
      return NextResponse.json(
        { error: "Failed to fetch social account data" },
        { status: 500 }
      );
    }

    // Combine the data
    const taskWithAccount = {
      ...task,
      social_account: socialAccount,
    };

    // If it's an immediate post, execute it now
    if (scheduleType === "now") {
      try {
        await executePost(taskWithAccount as Task, supabase);
      } catch (error) {
        // Log the error but don't fail the request
        console.error("Error executing immediate post:", error);
        await supabase.from("task_logs").insert([
          {
            task_id: task.id,
            execution_time: new Date().toISOString(),
            result: "failed",
            message: error instanceof Error ? error.message : "Unknown error",
          },
        ]);
      }
    }

    return NextResponse.json({
      message:
        scheduleType === "now"
          ? "Post created successfully"
          : "Post scheduled successfully",
      taskId: task.id,
    });
  } catch (error) {
    console.error("Error in create-post:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function executePost(task: Task, supabase: any) {
  let context: BrowserContext | undefined;
  let page: Page | undefined;

  try {
    // Get account details
    const { data: account, error: accountError } = await supabase
      .from("social_accounts")
      .select("*")
      .eq("id", task.social_account_id)
      .single();

    if (accountError || !account) {
      throw new Error("Account not found");
    }

    // Configure proxy if available
    const proxyConfig = account.proxy_ip && account.proxy_port ? {
      type: 'http' as const,
      server: account.proxy_ip,
      port: account.proxy_port.toString(),
      username: account.proxy_username || "",
      password: account.proxy_password || "",
    } : undefined;

    // // Validate proxy if configured
    // if (proxyConfig) {
    //   const isValid = await validateProxy(proxyConfig);
    //   if (!isValid) {
    //     throw new Error("Proxy validation failed");
    //   }
    // }

    // Create browser with stealth configuration and proxy
    const setup = await createStealthSetup(account.cookies, proxyConfig);
    context = setup.context;
    page = setup.page;

    if (!page) {
      throw new Error("Failed to create new page");
    }

    // Update proxy last used timestamp
    if (proxyConfig) {
      await supabase
        .from("social_accounts")
        .update({ proxy_last_used: new Date().toISOString() })
        .eq("id", task.social_account_id);
    }

    // Navigate to Facebook
    await page.goto("https://www.facebook.com/", {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    // Wait for the page to load
    await page.waitForTimeout(3000);

    // Navigate directly to the user's profile page
    await page.goto(
      `https://www.facebook.com/${task.social_account.username}`,
      {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      }
    );

    // Wait for the profile page to load
    await page.waitForTimeout(5000);

    // Debug: Log all elements with "What's on your mind?" text
    const elements = await page.$$("div");
    for (const element of elements) {
      const text = await element.textContent();
      if (text && text.includes("What's on your mind")) {
        const role = await element.getAttribute("role");
        const ariaLabel = await element.getAttribute("aria-label");
        const className = await element.getAttribute("class");
      }
    }

    // Look for the clickable "What's on your mind?" button on the profile
    const postButton = await page.waitForSelector(
      'div[role="button"]:has-text("What\'s on your mind?")',
      {
        timeout: 10000,
      }
    );

    if (!postButton) {
      throw new Error("Could not find post creation button");
    }

    await postButton.click();
    await page.waitForTimeout(2000);

    // Debug: Log all elements in the dialog
    const allDialogElements = await page.$$('div[role="dialog"] *');

    for (const element of allDialogElements) {
      const text = await element.textContent();
      if (text && text.includes("Post")) {
        await element.getAttribute("role");
        await element.getAttribute("class");
      }
    }

    // Wait for the dialog to appear and find the text area with placeholder
    const textArea = await page.waitForSelector(
      'div.xzsf02u.x1a2a7pz.x1n2onr6.x14wi4xw.x9f619.x1lliihq.x5yr21d.xh8yej3.notranslate[contenteditable="true"][role="textbox"][data-lexical-editor="true"]',
      {
        timeout: 10000,
      }
    );

    if (!textArea) {
      throw new Error("Could not find post input area");
    }

    // Click the text area to focus it
    await textArea.click();

    // Type the content using Playwright's type method
    await textArea.type(task.action_data.content, { delay: 100 }); // Add small delay between keystrokes

    // Verify the content was typed
    const typedContent = await page.evaluate(() => {
      const textArea = document.querySelector(
        'div.xzsf02u.x1a2a7pz.x1n2onr6.x14wi4xw.x9f619.x1lliihq.x5yr21d.xh8yej3.notranslate[contenteditable="true"][role="textbox"][data-lexical-editor="true"]'
      );
      const p = textArea?.querySelector(
        "p.xdj266r.x11i5rnm.xat24cr.x1mh8g0r.x16tdsg8"
      );
      return p ? p.textContent : null;
    });

    if (
      !typedContent ||
      typedContent.trim() !== task.action_data.content.trim()
    ) {
      console.error("Content verification failed:", {
        expected: task.action_data.content,
        actual: typedContent,
      });
      throw new Error("Failed to type content into text area");
    }

    await page.waitForTimeout(2000);

    // Wait for the post button to be enabled
    await page.waitForTimeout(2000);

    // Try to find and click the Post button
    const clicked = await page.evaluate(() => {
      // Find all elements with text "Post"
      const elements = Array.from(document.querySelectorAll("*"));
      const postButton = elements.find(
        (el) =>
          el.textContent?.trim() === "Post" &&
          (el.getAttribute("role") === "button" ||
            el.closest('[role="button"]') !== null)
      );

      if (postButton) {
        // Try to click the button or its parent
        const buttonToClick =
          postButton.getAttribute("role") === "button"
            ? postButton
            : postButton.closest('[role="button"]');

        if (buttonToClick) {
          // Create and dispatch a click event
          const clickEvent = new MouseEvent("click", {
            view: window,
            bubbles: true,
            cancelable: true,
            buttons: 1,
          });
          buttonToClick.dispatchEvent(clickEvent);
          return true;
        }
      }
      return false;
    });

    if (!clicked) {
      throw new Error("Could not find or click Post button");
    }

    // Wait for network to be idle and page to stabilize
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(3000);

    // Verify the post was created by checking multiple possible selectors
    const postContent = await Promise.race([
      page.waitForSelector(
        `div[data-pagelet="FeedUnit_0"]:has-text("${task.action_data.content}")`,
        { timeout: 15000 }
      ),
      page.waitForSelector(
        `div[role="article"]:has-text("${task.action_data.content}")`,
        { timeout: 15000 }
      ),
      page.waitForSelector(
        `div[data-ad-preview="message"]:has-text("${task.action_data.content}")`,
        { timeout: 15000 }
      ),
    ]);

    if (!postContent) {
      throw new Error("Post content not found after posting");
    }

    // Log success to task_logs
    await supabase.from("task_logs").insert([
      {
        task_id: task.id,
        execution_time: new Date().toISOString(),
        result: "success",
        message: "Post created successfully",
      },
    ]);

    // Update task status
    await supabase
      .from("tasks")
      .update({ status: "completed" })
      .eq("id", task.id);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Error executing post:", error);

    // Log the error
    await supabase.from("task_logs").insert([
      {
        task_id: task.id,
        execution_time: new Date().toISOString(),
        result: "failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
    ]);

    // Update task status
    await supabase.from("tasks").update({ status: "failed" }).eq("id", task.id);

    throw error;
  } finally {
    // Cleanup
    if (page) await page.close();
    if (context) await context.close();
    await cleanup();
  }
}
