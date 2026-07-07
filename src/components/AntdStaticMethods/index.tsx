// Entry component
import { App } from 'antd'
import { type MessageInstance } from 'antd/es/message/interface'
import { type ModalStaticFunctions } from 'antd/es/modal/confirm'
import { type NotificationInstance } from 'antd/es/notification/interface'
import { memo } from 'react'

let message: MessageInstance
let notification: NotificationInstance
let modal: Omit<ModalStaticFunctions, 'warn'>

// eslint-disable-next-line react/display-name
export default memo(() => {
  const staticFunction = App.useApp()
  // eslint-disable-next-line react-hooks/globals
  message = staticFunction.message
  // eslint-disable-next-line react-hooks/globals
  modal = staticFunction.modal
  // eslint-disable-next-line react-hooks/globals
  notification = staticFunction.notification
  return null
})

export { message, modal, notification }
