import { createBrowserClient } from "@supabase/ssr"

/**
 * Get Supabase environment variables with validation
 */
function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error(
      "Missing Supabase environment variables. Please ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set."
    )
  }

  return { url, key }
}

/**
 * Create a Supabase client for client-side usage
 * This client is suitable for Client Components
 */
export function createClient() {
  const { url, key } = getSupabaseEnv()
  return createBrowserClient(url, key)
}

/**
 * Pre-initialized Supabase client instance
 * Use this for convenience in Client Components
 */
export const supabase = createClient()