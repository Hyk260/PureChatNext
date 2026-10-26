import { describe, expect, it, vi } from 'vitest'

import { calculateCpuUsagePercent, calculateMemoryUsagePercent, SystemMetricsService } from '../SystemMetricsService'
import type { CpuTimes } from '../SystemMetricsService'

const cpuTimes = (times: Partial<CpuTimes>): CpuTimes => ({
  idle: 0,
  irq: 0,
  nice: 0,
  sys: 0,
  user: 0,
  ...times,
})

describe('system metrics', () => {
  it('calculates CPU usage from consecutive samples', () => {
    expect(calculateCpuUsagePercent(null, cpuTimes({ user: 10 }))).toBeNull()
    expect(
      calculateCpuUsagePercent(cpuTimes({ idle: 60, sys: 20, user: 20 }), cpuTimes({ idle: 100, sys: 40, user: 60 }))
    ).toBe(60)
    expect(calculateCpuUsagePercent(cpuTimes({ idle: 10 }), cpuTimes({ idle: 10 }))).toBeNull()
  })

  it('clamps memory usage and handles unavailable totals', () => {
    expect(calculateMemoryUsagePercent(1000, 600)).toBe(40)
    expect(calculateMemoryUsagePercent(1000, 1500)).toBe(0)
    expect(calculateMemoryUsagePercent(1000, -1)).toBe(100)
    expect(calculateMemoryUsagePercent(0, 0)).toBeNull()
    expect(calculateMemoryUsagePercent(1000, 10, 200)).toBe(79)
    expect(calculateMemoryUsagePercent(1000, 10, 1200)).toBe(0)
    expect(calculateMemoryUsagePercent(1000, 10, Number.NaN)).toBeNull()
  })

  it.each<NodeJS.Platform>(['darwin', 'win32', 'linux'])(
    'accounts for reclaimable cache only on macOS (%s)',
    (platform) => {
      const service = new SystemMetricsService({
        arch: () => 'arm64',
        cpus: () => [],
        getSystemMemoryInfo: () => ({ total: 1000, free: 10, fileBacked: 180, purgeable: 20 }),
        hostname: () => 'test-host',
        platform: () => platform,
      })

      expect(service.getMetrics().memoryUsagePercent).toBe(platform === 'darwin' ? 79 : 99)
    }
  )

  it('returns host details and waits for a second CPU sample', () => {
    const cpus = vi
      .fn()
      .mockReturnValueOnce([{ times: cpuTimes({ idle: 60, sys: 20, user: 20 }) }])
      .mockReturnValueOnce([{ times: cpuTimes({ idle: 100, sys: 40, user: 60 }) }])
    const service = new SystemMetricsService({
      arch: () => 'arm64',
      cpus,
      getSystemMemoryInfo: () => ({ total: 1000, free: 600 }),
      hostname: () => 'test-host',
      platform: () => 'darwin',
    })

    expect(service.getMetrics()).toEqual({
      arch: 'arm64',
      cpuUsagePercent: null,
      hostname: 'test-host',
      memoryUsagePercent: 40,
      platform: 'darwin',
    })
    expect(service.getMetrics().cpuUsagePercent).toBe(60)
  })

  it('resets CPU sampling after the overview has been inactive', () => {
    let sampledAt = 0
    const cpus = vi.fn(() => [{ times: cpuTimes({ idle: sampledAt, sys: sampledAt, user: sampledAt }) }])
    const service = new SystemMetricsService(
      {
        arch: () => 'arm64',
        cpus,
        getSystemMemoryInfo: () => ({ total: 1000, free: 600 }),
        hostname: () => 'test-host',
        platform: () => 'darwin',
      },
      () => sampledAt
    )

    expect(service.getMetrics().cpuUsagePercent).toBeNull()
    sampledAt = 3_000
    expect(service.getMetrics().cpuUsagePercent).toBe(67)
    sampledAt = 20_000
    expect(service.getMetrics().cpuUsagePercent).toBeNull()
    sampledAt = 23_000
    expect(service.getMetrics().cpuUsagePercent).toBe(67)
  })
})
