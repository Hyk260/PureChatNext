'use client'

import { SearchBar as LobeSearchBar } from '@lobehub/ui'
import type { SearchBarProps } from '@lobehub/ui'
import { mergeInputFocusClassName } from '../Input/Input'

export function SearchBar({ classNames, ...props }: SearchBarProps) {
  return (
    <LobeSearchBar
      {...props}
      classNames={{
        ...classNames,
        input: mergeInputFocusClassName(classNames?.input),
      }}
    />
  )
}
