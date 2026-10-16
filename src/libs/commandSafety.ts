const DANGEROUS_COMMAND_PATTERNS = [
  /(^|[\s;&|])sudo(?=\s|$)/i,
  /(^|[\s;&|])rm\s+(-[rf]+\s+)*\/(?:\s|$)/i,
  /:\(\)\s*\{.*:\|:.*\}/,
  /(^|[\s;&|])dd\s+if=/i,
  /(^|[\s;&|])mkfs(?=\s|$)/i,
  /(^|[\s;&|])(shutdown|reboot)(?=\s|$)/i,
]

const VERSION_COMMANDS = new Map<string, ReadonlySet<string>>([
  ['bun', new Set(['-v', '--version'])],
  ['deno', new Set(['-V', '--version'])],
  ['git', new Set(['--version'])],
  ['node', new Set(['-v', '--version'])],
  ['nodejs', new Set(['-v', '--version'])],
  ['npm', new Set(['-v', '--version'])],
  ['pnpm', new Set(['-v', '--version'])],
  ['python', new Set(['-V', '--version'])],
  ['python3', new Set(['-V', '--version'])],
  ['ruby', new Set(['-v'])],
  ['yarn', new Set(['-v', '--version'])],
])
const SAFE_SYSCTL_KEYS = new Set([
  'hw.logicalcpu',
  'hw.memsize',
  'hw.model',
  'hw.ncpu',
  'hw.physicalcpu',
  'kern.osrelease',
  'machdep.cpu.brand_string',
])

const SHELL_CONTROL_OPERATORS = /&&|\|\||;/
const UNSUPPORTED_SHELL_SYNTAX = /[|&<>`$()\\'"*?\[\]{}!#\n\r]/

/** Commands that are never auto-approved, even when the user selected full access. */
export const isDangerousCommand = (command: string) =>
  DANGEROUS_COMMAND_PATTERNS.some((pattern) => pattern.test(command))

const tokenizeSafeSegment = (segment: string) => {
  const withoutDiscardedStderr = segment.replace(/(^|\s)2>\/dev\/null(?=\s|$)/g, '$1').trim()
  if (!withoutDiscardedStderr || UNSUPPORTED_SHELL_SYNTAX.test(withoutDiscardedStderr)) return null

  const tokens = withoutDiscardedStderr.split(/\s+/)
  if (tokens.some((token) => !/^[A-Za-z0-9_./:+-]+$/.test(token))) return null
  return tokens
}

const isSafeVersionCommand = (command: string, args: string[]) =>
  args.length === 1 && (VERSION_COMMANDS.get(command)?.has(args[0]) ?? false)

const isSafeDiagnosticCommand = (command: string, args: string[]) => {
  if (isSafeVersionCommand(command, args)) return true

  switch (command) {
    case 'df':
      return args.every((arg) => ['-h', '-H', '-k', '-P'].includes(arg) || arg === '/')
    case 'true':
    case 'uptime':
      return args.length === 0
    case 'sw_vers':
      return args.every((arg) => ['-buildVersion', '-productName', '-productVersion'].includes(arg))
    case 'sysctl':
      return args.length >= 2 && args[0] === '-n' && args.slice(1).every((key) => SAFE_SYSCTL_KEYS.has(key))
    case 'uname':
      return args.length <= 1 && (args.length === 0 || ['-a', '-m', '-n', '-r', '-s', '-v'].includes(args[0]))
    default:
      return false
  }
}

/**
 * Allows a narrow set of read-only diagnostics in auto mode. Compound shell
 * commands are checked segment by segment; unsupported shell syntax fails closed.
 */
export const isLowRiskCommand = (command: string) => {
  const normalized = command.trim()
  if (!normalized || isDangerousCommand(normalized)) return false

  const segments = normalized.split(SHELL_CONTROL_OPERATORS)
  if (segments.length === 0 || segments.some((segment) => !segment.trim())) return false

  return segments.every((segment) => {
    const tokens = tokenizeSafeSegment(segment)
    if (!tokens) return false
    const [name, ...args] = tokens
    return isSafeDiagnosticCommand(name, args)
  })
}
