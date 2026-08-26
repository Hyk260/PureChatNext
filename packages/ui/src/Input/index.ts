/** Expose the shared input primitives through the application UI package. */
import { Input as LobeInput, InputOPT, InputPassword, TextArea } from '@lobehub/ui'
import type { InputOPTProps, InputPasswordProps, InputProps, TextAreaProps } from '@lobehub/ui'
import type { InputRef } from 'antd'

type CompatibleInput = typeof LobeInput & {
  OTP: typeof InputOPT
  Password: typeof InputPassword
  TextArea: typeof TextArea
}

const Input = Object.assign(LobeInput, {
  OTP: InputOPT,
  Password: InputPassword,
  TextArea,
}) as CompatibleInput

export {
  Input,
  InputPassword,
  type InputOPTProps,
  type InputPasswordProps,
  type InputProps,
  type InputRef,
  type TextAreaProps,
}
