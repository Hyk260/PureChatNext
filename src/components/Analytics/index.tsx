import { analyticsEnv } from '@/envs/analytics';

import Vercel from './Vercel';

const Analytics = () => {
  return (
    <>
      {analyticsEnv.ENABLE_VERCEL_ANALYTICS && (
        <Vercel debug={analyticsEnv.DEBUG_VERCEL_ANALYTICS} />
      )}
    </>
  );
};

export default Analytics;
