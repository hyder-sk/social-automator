import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { createStealthSetup } from "@/lib/playwright-config";
import { z } from "zod";
import { Page, BrowserContext } from "playwright";

interface SocialAccount {
  id: string;
  user_id: string;
  email: string;
  password: string;
  platform: string;
  type: string;
  username: string;
  cookies: string;
  proxy_ip?: string;
  proxy_port?: number;
}

interface Task {
  id: string;
  user_id: string;
  social_account_id: string;
  type: string;
  action_data: {
    post_url: string;
    action_type: "like";
    reaction_type?: "like" | "love" | "care" | "haha" | "wow" | "sad" | "angry";
  };
  schedule_type: string;
  schedule_data: {
    scheduled_time?: string;
  };
  status: string;
  next_run_at: string;
}

// Schema for request validation
const likePostSchema = z.object({
  url: z.string().url("Invalid post URL"),
  accountId: z.string().uuid("Invalid account ID"),
  type: z.string().optional(),
  reaction: z.string().optional(),
});

export async function POST(request: NextRequest) {
  let context: BrowserContext | null = null;
  let page: Page | null = null;

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

    // Parse and validate request body
    const body = await request.json();
    const { url, accountId, type, reaction } = likePostSchema.parse(body);

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

    // Create task data
    const taskData = {
      user_id: session.user.id,
      social_account_id: accountId,
      type: "like",
      action_data: {
        post_url: url,
        action_type: "like",
        reaction_type: reaction || "like",
      },
      schedule_type: "once",
      schedule_data: {},
      status: "active",
      next_run_at: new Date().toISOString(),
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
      throw new Error("Failed to create new page");
    }

    // Navigate to the post URL
    await page.goto(task.action_data.post_url, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    // Wait for the page to load
    await page.waitForTimeout(3000);

    // Find and click the like button using the robust method
    const likeButtonResult = await findAndClickLikeButton(page);

    if (!likeButtonResult.success) {
      // Log failure to task_logs
      await supabase.from("task_logs").insert([
        {
          task_id: task.id,
          execution_time: new Date().toISOString(),
          result: "failed",
          message: "Could not find or click Like button",
        },
      ]);

      // Update task status
      await supabase
        .from("tasks")
        .update({ status: "failed" })
        .eq("id", task.id);

      throw new Error("Could not find or click Like button");
    }

    if (likeButtonResult.alreadyLiked) {
      // Log success to task_logs
      await supabase.from("task_logs").insert([
        {
          task_id: task.id,
          execution_time: new Date().toISOString(),
          result: "success",
          message: "Post is already liked",
        },
      ]);

      // Update task status
      await supabase
        .from("tasks")
        .update({ status: "completed" })
        .eq("id", task.id);

      return NextResponse.json({
        success: true,
        message: "Post is already liked",
      });
    }

    // Wait for reaction selector
    try {
      await page.waitForSelector('[aria-label="Like"], [aria-label="React"]', {
        timeout: 5000,
      });
    } catch (error) {
      // Log failure to task_logs
      await supabase.from("task_logs").insert([
        {
          task_id: task.id,
          execution_time: new Date().toISOString(),
          result: "failed",
          message: "Failed to find reaction selector",
        },
      ]);

      // Update task status
      await supabase
        .from("tasks")
        .update({ status: "failed" })
        .eq("id", task.id);

      throw new Error("Failed to find reaction selector");
    }

    // Click reaction button again
    const clickResult = await page.evaluate(() => {
      const selectors = [
        '[aria-label="Like"][role="button"]',
        '[aria-label="React"][role="button"]',
        'button[aria-label="Like"]',
        'button[aria-label="React"]',
        '[role="button"][aria-label="Like"]',
        '[role="button"][aria-label="React"]',
      ];

      for (const selector of selectors) {
        const button = document.querySelector(selector) as HTMLElement | null;
        if (button && button.offsetParent !== null) {
          try {
            button.click();
            return true;
          } catch (e) {
            try {
              const clickEvent = new MouseEvent("click", {
                view: window,
                bubbles: true,
                cancelable: true,
                buttons: 1,
              });
              button.dispatchEvent(clickEvent);
              return true;
            } catch (e) {
              try {
                const mousedownEvent = new MouseEvent("mousedown", {
                  view: window,
                  bubbles: true,
                  cancelable: true,
                  buttons: 1,
                });
                const mouseupEvent = new MouseEvent("mouseup", {
                  view: window,
                  bubbles: true,
                  cancelable: true,
                  buttons: 1,
                });
                button.dispatchEvent(mousedownEvent);
                button.dispatchEvent(mouseupEvent);
                return true;
              } catch (e) {
                console.error("All click methods failed for selector:", selector);
              }
            }
          }
        }
      }
      return false;
    });

    if (!clickResult) {
      // Log failure to task_logs
      await supabase.from("task_logs").insert([
        {
          task_id: task.id,
          execution_time: new Date().toISOString(),
          result: "failed",
          message: "Failed to click reaction button",
        },
      ]);

      // Update task status
      await supabase
        .from("tasks")
        .update({ status: "failed" })
        .eq("id", task.id);

      throw new Error("Failed to click reaction button");
    }

    // Wait for reaction to be applied
    await page.waitForTimeout(2000);

    // Verify reaction
    const verificationResult = await page.evaluate(() => {
      const reactionIndicators = Array.from(
        document.querySelectorAll('[aria-label*="reaction"]')
      );
      const hasReactionIndicator = reactionIndicators.some((indicator) => {
        const label = indicator.getAttribute("aria-label") || "";
        return (
          label.includes("You reacted") ||
          label.includes("You and") ||
          label.includes("others reacted") ||
          label.includes("Like") ||
          label.includes("Unlike")
        );
      });

      const likeButton = Array.from(
        document.querySelectorAll('button, [role="button"]')
      ).find((button) => {
        const ariaLabel = button.getAttribute("aria-label") || "";
        return (
          (ariaLabel === "Like" ||
            ariaLabel === "React" ||
            ariaLabel === "Unlike" ||
            ariaLabel === "Remove Like") &&
          button.getAttribute("aria-pressed") === "true"
        );
      });
      const isButtonActive = !!likeButton;

      const reactionCounts = Array.from(
        document.querySelectorAll('[aria-label*="reactions"]')
      );
      const hasReactionCount = reactionCounts.some((count) => {
        const text = count.textContent || "";
        return text.includes("1") || text.includes("You");
      });

      const reactionEmojis = Array.from(
        document.querySelectorAll('[aria-label*="emoji"]')
      );
      const hasReactionEmoji = reactionEmojis.some((emoji) => {
        const label = emoji.getAttribute("aria-label") || "";
        return label.includes("Like") || label.includes("You");
      });

      return {
        hasReactionIndicator,
        isButtonActive,
        hasReactionCount,
        hasReactionEmoji,
      };
    });

    const isReactionApplied =
      verificationResult.hasReactionIndicator ||
      verificationResult.isButtonActive ||
      verificationResult.hasReactionCount ||
      verificationResult.hasReactionEmoji;

    if (!isReactionApplied) {
      // Log failure to task_logs
      await supabase.from("task_logs").insert([
        {
          task_id: task.id,
          execution_time: new Date().toISOString(),
          result: "failed",
          message: "Could not verify reaction was applied",
        },
      ]);

      // Update task status
      await supabase
        .from("tasks")
        .update({ status: "failed" })
        .eq("id", task.id);

      throw new Error("Could not verify reaction was applied");
    }

    // Log success to task_logs
    await supabase.from("task_logs").insert([
      {
        task_id: task.id,
        execution_time: new Date().toISOString(),
        result: "success",
        message: "Like action completed successfully",
      },
    ]);

    // Update task status
    await supabase
      .from("tasks")
      .update({ status: "completed" })
      .eq("id", task.id);

    return NextResponse.json({
      success: true,
      message: "Post liked successfully",
      taskId: task.id,
    });
  } catch (error) {
    console.error("Error liking post:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to like post",
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  } finally {
    if (context) await context.close();
  }
}

async function findAndClickLikeButton(
  page: Page
): Promise<{ success: boolean; alreadyLiked: boolean }> {
  return await page.evaluate(() => {
    // First find the main post actions container
    const postActionsContainer = Array.from(
      document.querySelectorAll("div")
    ).find((div) => {
      const children = Array.from(div.children);
      return children.some((child) => {
        const buttons = Array.from(child.querySelectorAll('[role="button"]'));
        return buttons.some((button) => {
          const ariaLabel = button.getAttribute("aria-label") || "";
          return ariaLabel === "Leave a comment" || ariaLabel === "Comment";
        });
      });
    });

    if (!postActionsContainer) {
      return { success: false, alreadyLiked: false };
    }

    // Find the Like button within the post actions container
    const likeButton = Array.from(
      postActionsContainer.querySelectorAll('[role="button"]')
    ).find((button) => {
      const ariaLabel = button.getAttribute("aria-label") || "";
      const hasLikeText = button.textContent?.includes("Like") || false;
      const hasLikeIcon =
        button.querySelector('i[data-visualcompletion="css-img"]') !== null;

      return (
        (ariaLabel === "Like" ||
          ariaLabel === "React" ||
          ariaLabel === "Remove Like") &&
        hasLikeText &&
        hasLikeIcon
      );
    });

    if (!likeButton) {
      return { success: false, alreadyLiked: false };
    }

    // Check if already liked
    const ariaLabel = likeButton.getAttribute("aria-label") || "";
    const isAlreadyLiked =
      ariaLabel.includes("Unlike") ||
      ariaLabel.includes("Remove Like") ||
      likeButton.getAttribute("aria-pressed") === "true";

    if (isAlreadyLiked) {
      return { success: true, alreadyLiked: true };
    }

    // Click the button
    try {
      (likeButton as HTMLElement).click();
      return { success: true, alreadyLiked: false };
    } catch (error) {
      return { success: false, alreadyLiked: false };
    }
  });
}
