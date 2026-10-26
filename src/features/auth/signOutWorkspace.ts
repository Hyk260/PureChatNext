import { useAgentsStore } from '@/features/home/store/useAgentsStore'
import { setChatRuntimeOwner } from '@/features/chat/runtime/store'
import { signOut } from '@/libs/better-auth/client'
import { isDesktopRenderer } from '@/utils/desktopAuth'
import { resetBrowserWorkspace } from '@/features/chat/WorkPanel/Browser/store'

/** Clear workspace client state, then end the Better Auth session. */
export async function signOutWorkspace() {
  resetBrowserWorkspace()
  setChatRuntimeOwner(null)
  useAgentsStore.getState().reset()
  if (!isDesktopRenderer()) {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined)
  }
  await signOut()
}
