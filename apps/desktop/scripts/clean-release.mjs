import { mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const releaseDir = fileURLToPath(new URL('../release/', import.meta.url))

export async function cleanRelease(directory = releaseDir) {
  await rm(directory, { recursive: true, force: true })
  await mkdir(directory, { recursive: true })
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await cleanRelease()
}
