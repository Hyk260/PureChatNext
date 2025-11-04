import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

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
 * Create a Supabase client for server-side usage
 * This client handles cookies and is suitable for Server Components, Server Actions, and Route Handlers
 */
export async function createClient() {
  const cookieStore = await cookies()
  const { url, key } = getSupabaseEnv()

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        } catch (error) {
          // The "setAll" method was called from a Server Component.
          // This can be ignored if you have middleware refreshing user sessions.
          // Log in development for debugging
          if (process.env.NODE_ENV === "development") {
            console.warn("Failed to set cookies in Server Component:", error)
          }
        }
      },
    },
  })
}
