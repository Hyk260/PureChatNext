import { Analytics } from '@vercel/analytics/react'
import { memo } from 'react'

interface VercelAnalyticsProps {
  debug?: boolean
}

const VercelAnalytics = memo<VercelAnalyticsProps>(({ debug }) => <Analytics debug={debug} />)

VercelAnalytics.displayName = 'VercelAnalytics'

export default VercelAnalytics
