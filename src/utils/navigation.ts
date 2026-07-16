/**
 * SPA navigation thin layer.
 * Source of truth for client imports; Next resolves real `next/navigation`,
 * Vite aliases `next/navigation` → `src/spa/shims/next-navigation.ts`.
 */
export {
  useParams,
  usePathname,
  useRouter,
  useSearchParams,
} from 'next/navigation'
