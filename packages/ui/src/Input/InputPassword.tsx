'use client'

import { InputPassword as LobeInputPassword } from '@lobehub/ui'
import type { InputPasswordProps } from '@lobehub/ui'

const VISIBILITY_LABELS = { show: '显示密码', hide: '隐藏密码' }

export function InputPassword(props: InputPasswordProps) {
  const value = 'value' in props ? (props.value ?? '') : undefined
  return (
    <LobeInputPassword
      visibilityToggleLabels={VISIBILITY_LABELS}
      {...props}
      className={props.className}
      value={value}
    />
  )
}
