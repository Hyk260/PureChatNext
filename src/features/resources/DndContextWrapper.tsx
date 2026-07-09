'use client'

import { type PropsWithChildren, memo } from 'react'

const DndContextWrapper = memo(({ children }: PropsWithChildren) => {
  return children
})

DndContextWrapper.displayName = 'DndContextWrapper'

export default DndContextWrapper

export const useDragActive = () => false

export const getTransparentDragImage = () => null
