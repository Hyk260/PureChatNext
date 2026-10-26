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

interface SystemMemoryInfo {
  total: number
  free: number
  fileBacked?: number
  purgeable?: number
}

interface SystemReader {
  arch: () => string
  cpus: () => CpuCore[]
  getSystemMemoryInfo: () => SystemMemoryInfo
  hostname: () => string
  platform: () => NodeJS.Platform
}

const systemReader: SystemReader = {
  arch: os.arch,
  cpus: os.cpus,
  getSystemMemoryInfo: () => process.getSystemMemoryInfo(),
  hostname: os.hostname,
  platform: os.platform,
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

export const calculateMemoryUsagePercent = (total: number, free: number, reclaimable = 0): number | null => {
  if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(free) || !Number.isFinite(reclaimable)) return null

  const used = Math.max(0, Math.min(total, total - free - Math.max(0, reclaimable)))
  return Math.round((used / total) * 100)
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

    const platform = this.system.platform()
    const memory = this.system.getSystemMemoryInfo()
    // macOS 文件缓存和可回收页可供系统复用，不计入实际内存占用；所有字段单位均为 KiB。
    const reclaimable = platform === 'darwin' ? (memory.fileBacked ?? 0) + (memory.purgeable ?? 0) : 0

    return {
      arch: this.system.arch(),
      cpuUsagePercent,
      hostname: this.system.hostname(),
      memoryUsagePercent: calculateMemoryUsagePercent(memory.total, memory.free, reclaimable),
      platform,
    }
  }
}
