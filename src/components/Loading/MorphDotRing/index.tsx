'use client'

import * as m from 'motion/react-m'

export const MorphDotRing = () => (
  <m.div
    animate={{ gap: ['4px', '0px', '4px'], rotate: 180 }}
    className='grid h-6 w-6 grid-cols-2 gap-1'
    transition={{ duration: 2, ease: 'easeInOut', repeat: Infinity }}
  >
    {[0, 1, 2, 3].map((i) => (
      <div key={i} className='h-full w-full rounded-full bg-zinc-800 dark:bg-white' />
    ))}
  </m.div>
)
