import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

/** Electron needs a local manifest version; the root manifest is the only maintained source. */
export function syncDesktopVersion(desktopDir) {
  const { version } = JSON.parse(readFileSync(path.resolve(desktopDir, '../../package.json'), 'utf8'))
  const manifestPath = path.join(desktopDir, 'package.json')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  if (manifest.version !== version) {
    manifest.version = version
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
  }
  return version
}
