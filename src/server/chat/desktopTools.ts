import { tool } from 'ai'
import type { ToolSet } from 'ai'
import { z } from 'zod'

const pathInput = z.string().trim().min(1).max(4096)

/** Schemas only: execution is deliberately delegated to the trusted desktop main process. */
export const desktopTools: ToolSet = {
  readFile: tool({
    description: 'Read a text file from the user-approved desktop workspace.',
    inputSchema: z.object({ path: pathInput }),
  }),
  listFiles: tool({
    description: 'List files in a user-approved desktop directory.',
    inputSchema: z.object({ path: pathInput.default('.') }),
  }),
  searchFiles: tool({
    description: 'Search file names in a user-approved desktop directory.',
    inputSchema: z.object({ path: pathInput.default('.'), query: z.string().trim().min(1).max(200) }),
  }),
  getSystemInfo: tool({
    description: 'Read non-sensitive operating system and runtime information from the desktop.',
    inputSchema: z.object({}),
  }),
  writeFile: tool({
    description: 'Write text to a desktop file after the user approves the operation.',
    inputSchema: z.object({ content: z.string().max(500_000), path: pathInput }),
  }),
  editFile: tool({
    description: 'Replace text in a desktop file after the user approves the operation.',
    inputSchema: z.object({ path: pathInput, replace: z.string(), search: z.string().min(1) }),
  }),
  moveFile: tool({
    description: 'Move a desktop file after the user approves the operation.',
    inputSchema: z.object({ destination: pathInput, source: pathInput }),
  }),
  runCommand: tool({
    description: 'Run a shell command on the desktop after explicit approval.',
    inputSchema: z.object({ command: z.string().trim().min(1).max(20_000) }),
  }),
  getCommandOutput: tool({
    description: 'Read output from a previously started desktop command.',
    inputSchema: z.object({ shellId: z.string().trim().min(1).max(200) }),
  }),
  killCommand: tool({
    description: 'Terminate a previously started desktop command.',
    inputSchema: z.object({ shellId: z.string().trim().min(1).max(200) }),
  }),
}
