'use client'

import * as m from 'motion/react-m'

export const PulseDots = () => (
  <div className='flex space-x-1.5'>
    {[0, 1, 2].map((i) => (
      <m.div
        key={i}
        animate={{ opacity: [0.2, 1, 0.2] }}
        className='h-2.5 w-2.5 rounded-full bg-zinc-800 dark:bg-white'
        transition={{ delay: i * 0.2, duration: 1.4, repeat: Infinity }}
      />
    ))}
  </div>
)
