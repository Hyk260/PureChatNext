import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { auth } from '@/auth'
import { ChatPage } from '@/features/chat'

/** Next SSR gate — SPA uses `routes/chat/_layout` + `RequireAuth` instead. */
export default async function Chat({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session?.user) {
    const sp = await searchParams
    const qs = new URLSearchParams()

    for (const [k, v] of Object.entries(sp)) {
      if (typeof v === 'string') qs.set(k, v)
      else if (Array.isArray(v) && v[0]) qs.set(k, v[0])
    }

    const q = qs.toString()
    redirect(`/signin?callbackUrl=${encodeURIComponent(q ? `/chat?${q}` : '/chat')}`)
  }

  return <ChatPage />
}
