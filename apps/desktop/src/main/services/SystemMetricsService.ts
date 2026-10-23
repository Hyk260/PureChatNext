import os from 'node:os'

import type { DesktopSystemMetrics } from '@/types/desktop'

const MAX_CPU_SAMPLE_GAP_MS = 10_000

export interface CpuTimes {
  idle: number
  irq: number
  nice: number
  sys: number
  user: number
}

interface CpuCore {
  times: CpuTimes
}

interface SystemReader {
  arch: () => string
  cpus: () => CpuCore[]
  freemem: () => number
  hostname: () => string
  platform: () => NodeJS.Platform
  totalmem: () => number
}

const systemReader: SystemReader = {
  arch: os.arch,
  cpus: os.cpus,
  freemem: os.freemem,
  hostname: os.hostname,
  platform: os.platform,
  totalmem: os.totalmem,
}

const sumCpuTimes = (cores: CpuCore[]): CpuTimes | null => {
  if (cores.length === 0) return null

  return cores.reduce(
    (total, core) => ({
      idle: total.idle + core.times.idle,
      irq: total.irq + core.times.irq,
      nice: total.nice + core.times.nice,
      sys: total.sys + core.times.sys,
      user: total.user + core.times.user,
    }),
    { idle: 0, irq: 0, nice: 0, sys: 0, user: 0 }
  )
}

const totalCpuTime = ({ idle, irq, nice, sys, user }: CpuTimes) => idle + irq + nice + sys + user

export const calculateCpuUsagePercent = (previous: CpuTimes | null, current: CpuTimes | null): number | null => {
  if (!previous || !current) return null

  const totalDelta = totalCpuTime(current) - totalCpuTime(previous)
  const idleDelta = current.idle - previous.idle
  if (totalDelta <= 0 || idleDelta < 0) return null

  const usage = ((totalDelta - idleDelta) / totalDelta) * 100
  return Math.min(100, Math.max(0, Math.round(usage)))
}

export const calculateMemoryUsagePercent = (totalBytes: number, freeBytes: number): number | null => {
  if (!Number.isFinite(totalBytes) || totalBytes <= 0 || !Number.isFinite(freeBytes)) return null

  const usedBytes = Math.max(0, Math.min(totalBytes, totalBytes - freeBytes))
  return Math.round((usedBytes / totalBytes) * 100)
}

export class SystemMetricsService {
  private previousCpuTimes: CpuTimes | null = null
  private previousCpuSampledAt: number | null = null

  constructor(
    private readonly system: SystemReader = systemReader,
    private readonly now: () => number = Date.now
  ) {}

  getMetrics(): DesktopSystemMetrics {
    const sampledAt = this.now()
    const currentCpuTimes = sumCpuTimes(this.system.cpus())
    const sampleGap = this.previousCpuSampledAt === null ? null : sampledAt - this.previousCpuSampledAt
    const previousCpuTimes =
      sampleGap !== null && sampleGap >= 0 && sampleGap <= MAX_CPU_SAMPLE_GAP_MS ? this.previousCpuTimes : null
    const cpuUsagePercent = calculateCpuUsagePercent(previousCpuTimes, currentCpuTimes)
    this.previousCpuTimes = currentCpuTimes
    this.previousCpuSampledAt = sampledAt

    return {
      arch: this.system.arch(),
      cpuUsagePercent,
      hostname: this.system.hostname(),
      memoryUsagePercent: calculateMemoryUsagePercent(this.system.totalmem(), this.system.freemem()),
      platform: this.system.platform(),
    }
  }
}
