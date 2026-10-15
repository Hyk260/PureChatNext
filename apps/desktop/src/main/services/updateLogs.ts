import { open, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

import type { DesktopUpdateLogs } from '@/types/desktopUpdater'

import { getLogDirectory, redactLogText } from '../logger'

const MAX_LOG_BYTES = 256 * 1024
const LOG_HEADER = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} \[\w+\](?:\s+\(([^)]+)\))?/
const LOG_FILENAME = /^\d{4}-\d{2}-\d{2}(?:\.old)?\.log$/

async function getUpdateLogFiles(logDir: string) {
  let entries
  try {
    entries = await readdir(logDir, { withFileTypes: true })
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return []
    throw error
  }
  return entries.filter((entry) => entry.isFile() && LOG_FILENAME.test(entry.name))
}

function withoutUpdateRecords(content: string) {
  let isUpdateRecord = false
  return content
    .split(/(?<=\n)/)
    .filter((line) => {
      const header = LOG_HEADER.exec(line)
      if (header) isUpdateRecord = header[1] === 'desktop:update'
      return !isUpdateRecord
    })
    .join('')
}

/** Read a bounded tail from the application's own logs, preserving multi-line update records. */
export async function readUpdateLogs(logDir = getLogDirectory()): Promise<DesktopUpdateLogs> {
  const files = (await getUpdateLogFiles(logDir))
    .sort((a, b) => {
      const byDate = a.name.slice(0, 10).localeCompare(b.name.slice(0, 10))
      return byDate || Number(!a.name.includes('.old.')) - Number(!b.name.includes('.old.'))
    })
  let truncated = files.length > 3
  const records: string[] = []
  for (const file of files.slice(-3)) {
    const handle = await open(path.join(logDir, file.name), 'r')
    try {
      const { size } = await handle.stat()
      const start = Math.max(0, size - MAX_LOG_BYTES)
      truncated ||= start > 0
      const buffer = Buffer.alloc(Math.min(size, MAX_LOG_BYTES))
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, start)
      let include = false
      for (const line of buffer.toString('utf8', 0, bytesRead).split('\n')) {
        const header = LOG_HEADER.exec(line)
        if (header) include = header[1] === 'desktop:update'
        if (include) records.push(line)
      }
    } finally {
      await handle.close()
    }
  }
  const text = redactLogText(records.join('\n').trim())
  const bytes = Buffer.from(text)
  truncated ||= bytes.length > MAX_LOG_BYTES
  let start = Math.max(0, bytes.length - MAX_LOG_BYTES)
  // Avoid returning a broken UTF-8 character when a long record crosses the tail boundary.
  while (start < bytes.length && (bytes[start] & 0xc0) === 0x80) start += 1
  return { text: bytes.subarray(start).toString('utf8'), truncated }
}

/** Remove updater records while preserving other categories in the shared log files. */
export async function clearUpdateLogs(logDir = getLogDirectory()): Promise<void> {
  const files = await getUpdateLogFiles(logDir)
  for (const file of files) {
    const filePath = path.join(logDir, file.name)
    const content = await readFile(filePath, 'utf8')
    const filtered = withoutUpdateRecords(content)
    if (filtered !== content) await writeFile(filePath, filtered)
  }
}
