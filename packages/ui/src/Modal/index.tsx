import { Modal as LobeModal } from '@lobehub/ui'
import type { ModalProps } from '@lobehub/ui'

/**
 * Unified declarative modal defaults for the application.
 * Individual call sites can still override these defaults when needed.
 */
const Modal = (props: ModalProps) => <LobeModal centered maskTransitionName='' transitionName='' {...props} />

Modal.displayName = 'Modal'

export { Modal, type ModalProps }
