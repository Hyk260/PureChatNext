export interface ContextWindowItem {
  id: string
  label: string
  tokens: number
}

export interface ContextWindowPart {
  id: string
  label: string
  tokens?: number
  items?: ContextWindowItem[]
  locked?: boolean
  compact?: boolean
}

export interface ContextWindowCell {
  index: number
  partId: string | null
  itemId?: string
  colorIndex?: number
}

export interface ContextWindowModel {
  totalTokens: number
  remainingTokens: number
  usedPercentage: number
  cells: ContextWindowCell[]
}

interface TokenSegment {
  partId: string
  itemId?: string
  colorIndex: number
  tokens: number
}

const normalizeTokens = (tokens: number | undefined): number =>
  typeof tokens === 'number' && Number.isFinite(tokens) ? Math.max(0, tokens) : 0

export const getContextWindowPartTokens = (part: ContextWindowPart): number => {
  if (part.items) {
    return part.items.reduce((total, item) => total + normalizeTokens(item.tokens), 0)
  }

  return normalizeTokens(part.tokens)
}

const getTokenSegments = (parts: ContextWindowPart[]): TokenSegment[] =>
  parts.flatMap((part, colorIndex) => {
    if (part.items) {
      return part.items.map((item) => ({
        colorIndex,
        itemId: item.id,
        partId: part.id,
        tokens: normalizeTokens(item.tokens),
      }))
    }

    return [
      {
        colorIndex,
        partId: part.id,
        tokens: normalizeTokens(part.tokens),
      },
    ]
  })

const createCells = (segments: TokenSegment[], limit: number, cellCount: number): ContextWindowCell[] => {
  let segmentIndex = 0
  let segmentEnd = segments[0]?.tokens ?? 0

  return Array.from({ length: cellCount }, (_, index) => {
    const tokenPosition = ((index + 0.5) / cellCount) * limit

    while (segmentIndex < segments.length && tokenPosition >= segmentEnd) {
      segmentIndex += 1
      segmentEnd += segments[segmentIndex]?.tokens ?? 0
    }

    const segment = segments[segmentIndex]
    const isOccupied = segment !== undefined && tokenPosition < segmentEnd && tokenPosition < limit

    return {
      colorIndex: isOccupied ? segment.colorIndex : undefined,
      index,
      itemId: isOccupied ? segment.itemId : undefined,
      partId: isOccupied ? segment.partId : null,
    }
  })
}

export const getContextWindowModel = (
  parts: ContextWindowPart[],
  limit: number,
  cellCount = 200
): ContextWindowModel => {
  const safeLimit = normalizeTokens(limit)
  const segments = getTokenSegments(parts)
  const totalTokens = segments.reduce((total, segment) => total + segment.tokens, 0)
  const usedPercentage = safeLimit > 0 ? Math.round((totalTokens / safeLimit) * 100) : 0

  return {
    cells: createCells(segments, safeLimit, cellCount),
    remainingTokens: Math.max(0, safeLimit - totalTokens),
    totalTokens,
    usedPercentage,
  }
}

export const formatContextTokens = (tokens: number, detailed = false): string => {
  const safeTokens = normalizeTokens(tokens)

  if (safeTokens >= 1_000_000) {
    const millions = safeTokens / 1_000_000
    const value = detailed ? millions.toFixed(1) : Number(millions.toFixed(1)).toString()
    return `${value}M`
  }

  if (safeTokens >= 1_000) {
    const thousands = safeTokens / 1_000
    const value = detailed ? thousands.toFixed(1) : Math.round(thousands).toString()
    return `${value}K`
  }

  return new Intl.NumberFormat('en-US').format(safeTokens)
}
