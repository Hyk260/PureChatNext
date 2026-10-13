import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { app, shell } from 'electron'

const profileArgument = process.argv.find((argument) => argument.startsWith('--e2e-profile='))
if (!profileArgument) throw new Error('Missing isolated Electron test profile')
const profileRoot = profileArgument.slice('--e2e-profile='.length)

for (const name of ['userData', 'sessionData', 'logs']) {
  const directory = path.join(profileRoot, name)
  mkdirSync(directory, { recursive: true })
  app.setPath(name, directory)
}

// Test startup must not register purechat:// as the operating system's default handler.
app.setAsDefaultProtocolClient = () => false
shell.openExternal = async () => {
  throw new Error('External browser access is disabled in Electron smoke tests')
}

const mainEntry = fileURLToPath(new URL('../../../apps/desktop/dist/main/index.js', import.meta.url))
import(pathToFileURL(mainEntry).href).catch((error) => {
  console.error(error)
  app.exit(1)
})
