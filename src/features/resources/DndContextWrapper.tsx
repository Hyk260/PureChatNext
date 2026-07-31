'use client'

import { memo } from 'react'
import type { PropsWithChildren } from 'react'

const DndContextWrapper = memo(({ children }: PropsWithChildren) => {
  return children
})

DndContextWrapper.displayName = 'DndContextWrapper'

export default DndContextWrapper

export const useDragActive = () => false

export const getTransparentDragImage = () => null
