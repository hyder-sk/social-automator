import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { ResponseCookie } from 'next/dist/compiled/@edge-runtime/cookies'
import { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies'

export const createClient = async (cookieStore?: ReadonlyRequestCookies | Promise<ReadonlyRequestCookies>) => {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable')
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable')
  }

  try {
    const client = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          async get(name: string) {
            const store = await cookieStore
            return store?.get(name)?.value
          },
          async set(name: string, value: string, options: Omit<ResponseCookie, 'name' | 'value'>) {
            const store = await cookieStore
            if (store) {
              store.set({ name, value, ...options })
            }
          },
          async remove(name: string, options: Omit<ResponseCookie, 'name' | 'value'>) {
            const store = await cookieStore
            if (store) {
              store.delete({ name, ...options })
            }
          },
        },
      }
    )

    // Test the connection using auth.users which should always be accessible
    const { data, error } = await client.auth.getUser()
    if (error) {
      console.error('Supabase connection test failed:', error)
      throw error
    }

    return client
  } catch (error) {
    console.error('Failed to create Supabase client:', error)
    throw error
  }
} 