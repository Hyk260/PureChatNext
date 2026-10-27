'use client'

import { Input as LobeInput, TextArea as LobeTextArea } from '@lobehub/ui'
import type { InputProps, TextAreaProps } from '@lobehub/ui'

export function Input({ className, ...props }: InputProps) {
  // FormKit supplies an explicit undefined before the first edit.
  const value = 'value' in props ? (props.value ?? '') : undefined
  return <LobeInput {...props} className={className} value={value} />
}

export function TextArea({ className, ...props }: TextAreaProps) {
  const value = 'value' in props ? (props.value ?? '') : undefined
  return <LobeTextArea {...props} className={className} value={value} />
}
