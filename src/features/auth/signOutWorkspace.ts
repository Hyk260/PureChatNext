import { useAgentsStore } from '@/features/home/store/useAgentsStore'
import { signOut } from '@/libs/better-auth/client'

/** Clear workspace client state, then end the Better Auth session. */
export async function signOutWorkspace() {
  useAgentsStore.getState().reset()
  await signOut()
}
