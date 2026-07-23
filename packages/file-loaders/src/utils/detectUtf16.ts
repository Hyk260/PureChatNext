const HEURISTIC_SAMPLE_BYTES = 512
const HEURISTIC_THRESHOLD = 0.3

export type Utf16Variant = 'utf-16le' | 'utf-16be'

/**
 * Guess BOM-less UTF-16 by counting ASCII-shaped code-unit pairs.
 * LE places the 0x00 high byte on odd indices; BE on even.
 *
 * Shared by the text loader (decoder choice) and the binary sniffer
 * (so alternating nulls are not mistaken for binary).
 */
export const detectUtf16NoBom = (buffer: Buffer): Utf16Variant | null => {
  const sample = buffer.subarray(0, Math.min(HEURISTIC_SAMPLE_BYTES, buffer.length))
  if (sample.length < 4 || sample.length % 2 !== 0) return null

  let leAsciiPairs = 0
  let beAsciiPairs = 0
  const totalPairs = sample.length / 2

  for (let i = 0; i < sample.length; i += 2) {
    const lo = sample[i]
    const hi = sample[i + 1]
    if (hi === 0x00 && lo !== 0x00) leAsciiPairs++
    else if (lo === 0x00 && hi !== 0x00) beAsciiPairs++
  }

  if (leAsciiPairs > beAsciiPairs && leAsciiPairs / totalPairs >= HEURISTIC_THRESHOLD) {
    return 'utf-16le'
  }
  if (beAsciiPairs > leAsciiPairs && beAsciiPairs / totalPairs >= HEURISTIC_THRESHOLD) {
    return 'utf-16be'
  }
  return null
}
