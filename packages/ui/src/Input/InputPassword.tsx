'use client'

import { InputPassword as LobeInputPassword } from '@lobehub/ui'
import type { InputPasswordProps } from '@lobehub/ui'
import { mergeInputFocusClassName } from './Input'

const VISIBILITY_LABELS = { show: '显示密码', hide: '隐藏密码' }

export function InputPassword(props: InputPasswordProps) {
  const value = 'value' in props ? (props.value ?? '') : undefined
  return (
    <LobeInputPassword
      visibilityToggleLabels={VISIBILITY_LABELS}
      {...props}
      className={mergeInputFocusClassName(props.className)}
      value={value}
    />
  )
}
