import { useAgentsStore } from '@/features/home/store/useAgentsStore'
import { signOut } from '@/libs/better-auth/client'
import { isDesktopRenderer } from '@/utils/desktopAuth'

/** Clear workspace client state, then end the Better Auth session. */
export async function signOutWorkspace() {
  useAgentsStore.getState().reset()
  if (!isDesktopRenderer()) {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined)
  }
  await signOut()
}
