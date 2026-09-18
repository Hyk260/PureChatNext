/** Expose the shared input primitives through the application UI package. */
import { Input as AntdInput } from 'antd'

export { Input, InputPassword, TextArea } from '@lobehub/ui'
export type { InputRef } from 'antd'

/** lobehub InputOPT 的 [class*='ant-otp-input'] 会误伤 wrapper，格子双边框。 */
export const InputOPT = AntdInput.OTP
