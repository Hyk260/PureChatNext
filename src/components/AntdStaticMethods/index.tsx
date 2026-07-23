import { App } from 'antd'
import { type MessageInstance } from 'antd/es/message/interface'
import { type ModalFuncProps } from 'antd/es/modal/interface'
import { type ModalStaticFunctions } from 'antd/es/modal/confirm'
import { type NotificationInstance } from 'antd/es/notification/interface'
import { memo } from 'react'

let message: MessageInstance
let notification: NotificationInstance
let modal: Omit<ModalStaticFunctions, 'warn'>

/**
 * 全局 modal.confirm / info / success / error / warning 默认配置。
 * - centered: 水平垂直居中
 * - transitionName: '' 关闭 antd 默认的 ant-zoom（从小变大）打开动画
 */
const MODAL_DEFAULTS: Partial<ModalFuncProps> = {
  centered: true,
  transitionName: '',
}

type ModalMethod<C extends ModalFuncProps = ModalFuncProps> = (config: C) => ReturnType<ModalStaticFunctions['confirm']>

function withModalDefaults<T extends ModalMethod>(method: T): T {
  return ((config: ModalFuncProps) => method({ ...MODAL_DEFAULTS, ...config })) as T
}

function wrapModal(instance: Omit<ModalStaticFunctions, 'warn'>): Omit<ModalStaticFunctions, 'warn'> {
  return {
    confirm: withModalDefaults(instance.confirm),
    error: withModalDefaults(instance.error),
    info: withModalDefaults(instance.info),
    success: withModalDefaults(instance.success),
    warning: withModalDefaults(instance.warning),
  }
}

// eslint-disable-next-line react/display-name
export default memo(() => {
  const staticFunction = App.useApp()
  // eslint-disable-next-line react-hooks/globals
  message = staticFunction.message
  // eslint-disable-next-line react-hooks/globals
  modal = wrapModal(staticFunction.modal)
  // eslint-disable-next-line react-hooks/globals
  notification = staticFunction.notification
  return null
})

/**
 * React 内使用的统一 hook，替代 `App.useApp()`。
 * 返回的 modal 已注入全局默认配置（居中 + 关闭 zoom 动画）。
 */
export function useApp() {
  const { modal: rawModal, ...rest } = App.useApp()
  return { ...rest, modal: wrapModal(rawModal) }
}

export { message, modal, notification }
