import dynamic from 'next/dynamic'

import { analyticsEnv } from '@/envs/analytics'

import Vercel from './Vercel'

const ReactScan = dynamic(() => import('./ReactScan'))

const Analytics = () => {
  return (
    <>
      {analyticsEnv.ENABLE_VERCEL_ANALYTICS && <Vercel debug={analyticsEnv.DEBUG_VERCEL_ANALYTICS} />}
      {!!analyticsEnv.REACT_SCAN_MONITOR_API_KEY && <ReactScan apiKey={analyticsEnv.REACT_SCAN_MONITOR_API_KEY} />}
    </>
  )
}

export default Analytics
