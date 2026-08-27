import { contextBridge } from 'electron'

import { createDesktopApi } from './api'

contextBridge.exposeInMainWorld('pureChatDesktop', createDesktopApi())
