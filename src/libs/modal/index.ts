'use client'

import { createModalSystem, type ModalSystem } from '@lobehub/ui/base-ui'

const GLOBAL_KEY = '__purechat_modal_system__' as const

type GlobalWithModal = typeof globalThis & {
  [GLOBAL_KEY]?: ModalSystem
}

function getModalSystem(): ModalSystem {
  const g = globalThis as GlobalWithModal
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = createModalSystem()
  }
  return g[GLOBAL_KEY]
}

const modalSystem = getModalSystem()

export const ModalHost = modalSystem.ModalHost
export const confirmModal = modalSystem.confirmModal
export const createModal = modalSystem.createModal
