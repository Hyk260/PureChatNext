// @vitest-environment node
import { EventEmitter } from 'node:events'

import type { WebContents } from 'electron'
import { describe, expect, it, vi } from 'vitest'

import type { IpcRegistry } from '../../ipc/IpcRegistry'
import type { TerminalService } from '../../services/TerminalService'
import { TerminalController } from '../TerminalController'

describe('terminal window lifecycle', () => {
  it('keeps SPA navigation alive and clears sessions on reload, crash and destruction', () => {
    const contents = Object.assign(new EventEmitter(), { id: 42, isDestroyed: () => false })
    const service = { open: vi.fn(), write: vi.fn(), resize: vi.fn(), kill: vi.fn(), reset: vi.fn() }
    const ipc = { register: vi.fn() }
    const controller = new TerminalController(
      service as unknown as TerminalService,
      () => contents as unknown as WebContents
    )
    controller.register(ipc as unknown as IpcRegistry)
    const open = ipc.register.mock.calls.find(([channel]) => channel === 'terminal.open')![1]
    const input = { projectId: null, cols: 80, rows: 24 }
    open(input)
    open(input)
    expect(service.open).toHaveBeenCalledWith(42, input)
    expect(contents.listenerCount('did-start-navigation')).toBe(1)
    contents.emit('did-start-navigation', {}, 'purechat://renderer/chat', true, true)
    contents.emit('did-start-navigation', {}, 'purechat://renderer/frame', false, false)
    expect(service.reset).not.toHaveBeenCalled()
    contents.emit('did-start-navigation', {}, 'purechat://renderer/', false, true)
    contents.emit('render-process-gone')
    contents.emit('destroyed')
    expect(service.reset).toHaveBeenCalledTimes(3)
    expect(contents.listenerCount('did-start-navigation')).toBe(0)
    controller.dispose()
    expect(contents.eventNames()).toEqual([])
  })
})
