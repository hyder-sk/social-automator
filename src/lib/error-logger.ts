import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { headers } from 'next/headers';

type LogCategory = 
  | 'auth'
  | 'task_execution'
  | 'api_error'
  | 'proxy_error'
  | 'rate_limit'
  | 'system'
  | 'account_verification'
  | 'media_upload'
  | 'database';

export async function logError({
  userId,
  taskId,
  socialAccountId,
  category,
  message,
  error,
  metadata = {},
}: {
  userId?: string;
  taskId?: string;
  socialAccountId?: string;
  category: LogCategory;
  message: string;
  error: unknown;
  metadata?: Record<string, any>;
}) {
  try {
    const cookieStore = cookies();
    const supabase = await createClient(cookieStore);
    const headersList = await headers();
    
    const errorDetails = error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
    } : {
      message: String(error)
    };

    await supabase.rpc('log_error', {
      p_user_id: userId,
      p_task_id: taskId,
      p_social_account_id: socialAccountId,
      p_category: category,
      p_message: message,
      p_error_details: errorDetails,
      p_stack_trace: error instanceof Error ? error.stack : undefined,
      p_metadata: {
        ...metadata,
        url: headersList.get('referer') || '',
        method: headersList.get('x-http-method') || '',
      },
      p_ip_address: headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || '',
      p_user_agent: headersList.get('user-agent') || '',
    });
  } catch (loggingError) {
    // If logging fails, at least log to console
    console.error('Failed to log error:', loggingError);
    console.error('Original error:', error);
  }
}

export async function logInfo({
  userId,
  taskId,
  socialAccountId,
  category,
  message,
  metadata = {},
}: {
  userId?: string;
  taskId?: string;
  socialAccountId?: string;
  category: LogCategory;
  message: string;
  metadata?: Record<string, any>;
}) {
  try {
    const cookieStore = cookies();
    const supabase = await createClient(cookieStore);
    const headersList = await headers();

    await supabase.rpc('log_info', {
      p_user_id: userId,
      p_task_id: taskId,
      p_social_account_id: socialAccountId,
      p_category: category,
      p_message: message,
      p_metadata: {
        ...metadata,
        url: headersList.get('referer') || '',
        method: headersList.get('x-http-method') || '',
      },
      p_ip_address: headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || '',
      p_user_agent: headersList.get('user-agent') || '',
    });
  } catch (loggingError) {
    console.error('Failed to log info:', loggingError);
  }
} 