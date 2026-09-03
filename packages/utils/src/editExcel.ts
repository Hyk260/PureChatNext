import path from 'node:path'

import * as xlsx from 'xlsx'

export type ExcelEditOperation =
  | {
      all?: boolean
      find: string
      mode?: 'exact' | 'substring'
      replace: string
      sheet?: string
      type: 'replace'
    }
  | {
      cell: string
      sheet: string
      type: 'set'
      value: string | number
    }

export type ExcelEditResult = {
  buffer: Buffer
  changes: Array<{ cell: string; from: string | number | boolean | null; sheet: string; to: string | number }>
  sheetNames: string[]
}

export class ExcelEditError extends Error {
  constructor(
    readonly code: 'AMBIGUOUS_MATCH' | 'FORMULA_CELL' | 'INVALID_FILE' | 'NO_MATCH' | 'UNSUPPORTED_WORKBOOK',
    message: string
  ) {
    super(message)
    this.name = 'ExcelEditError'
  }
}

const cellValue = (cell: xlsx.CellObject | undefined): string | number | boolean | null => {
  if (!cell || cell.v === undefined || cell.v === null) return null
  return cell.v as string | number | boolean
}

/**
 * 同步校验 .xlsx 文件是否具备合法 ZIP 魔数（PK\x03\x04）。
 * OOXML .xlsx 本质上是 ZIP 压缩包，没有合法 ZIP 头的必定不是真实 xlsx。
 * 注意：扩展名可能被伪造，这一步做字节级快速拦截；xlsx.read 还会在后续做更深校验。
 */
function looksLikeZipMagic(buffer: Buffer): boolean {
  return buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04
}

export function editExcelBuffer(
  input: Buffer,
  filename: string,
  operations: ExcelEditOperation[]
): ExcelEditResult {
  if (path.extname(filename).toLowerCase() !== '.xlsx') {
    throw new ExcelEditError('INVALID_FILE', '首版仅支持 .xlsx 文件。')
  }
  // 字节级魔数校验：避免把扩展名改为 .xlsx 的非 xlsx 文件直接丢给 xlsx.read
  if (!looksLikeZipMagic(input)) {
    throw new ExcelEditError('INVALID_FILE', '首版仅支持 .xlsx 文件。')
  }

  let workbook: xlsx.WorkBook
  try {
    workbook = xlsx.read(input, { bookFiles: true, bookVBA: true, cellStyles: true, type: 'buffer' })
  } catch {
    throw new ExcelEditError('INVALID_FILE', 'Excel 文件损坏或无法读取。')
  }
  if ((workbook as xlsx.WorkBook & { vbaraw?: unknown }).vbaraw) {
    throw new ExcelEditError('UNSUPPORTED_WORKBOOK', '包含宏的工作簿不支持自动修改。')
  }

  const changes: ExcelEditResult['changes'] = []
  for (const operation of operations) {
    if (operation.type === 'set') {
      const worksheet = workbook.Sheets[operation.sheet]
      if (!worksheet) throw new ExcelEditError('NO_MATCH', `未找到工作表“${operation.sheet}”。`)
      const address = operation.cell.toUpperCase()
      const current = worksheet[address]
      if (current?.f) throw new ExcelEditError('FORMULA_CELL', `${operation.sheet}!${address} 是公式单元格，未修改。`)
      const from = cellValue(current)
      worksheet[address] = { ...(current ?? {}), t: typeof operation.value === 'number' ? 'n' : 's', v: operation.value }
      changes.push({ cell: address, from, sheet: operation.sheet, to: operation.value })
      continue
    }

    const candidates: Array<{ address: string; from: string; sheet: string; to: string }> = []
    const sheetNames = operation.sheet ? [operation.sheet] : workbook.SheetNames
    for (const sheetName of sheetNames) {
      const worksheet = workbook.Sheets[sheetName]
      if (!worksheet) throw new ExcelEditError('NO_MATCH', `未找到工作表“${sheetName}”。`)
      for (const address of Object.keys(worksheet)) {
        if (address.startsWith('!')) continue
        const cell = worksheet[address]
        if (!cell || cell.f || typeof cell.v !== 'string') continue
        const matches = operation.mode === 'exact' ? cell.v === operation.find : cell.v.includes(operation.find)
        if (!matches) continue
        candidates.push({
          address,
          from: cell.v,
          sheet: sheetName,
          to: operation.mode === 'exact' ? operation.replace : cell.v.replaceAll(operation.find, operation.replace),
        })
      }
    }
    if (candidates.length === 0) throw new ExcelEditError('NO_MATCH', `未找到文本“${operation.find}”。`)
    if (candidates.length > 1 && operation.all !== true) {
      const locations = candidates.slice(0, 8).map(({ address, sheet }) => `${sheet}!${address}`).join('、')
      throw new ExcelEditError('AMBIGUOUS_MATCH', `找到 ${candidates.length} 处匹配（${locations}），请指定工作表/单元格或确认全部替换。`)
    }
    for (const candidate of operation.all === true ? candidates : candidates.slice(0, 1)) {
      const cell = workbook.Sheets[candidate.sheet]![candidate.address]!
      cell.v = candidate.to
      cell.w = undefined
      changes.push({ cell: candidate.address, from: candidate.from, sheet: candidate.sheet, to: candidate.to })
    }
  }

  return {
    buffer: Buffer.from(xlsx.write(workbook, { bookType: 'xlsx', cellStyles: true, type: 'buffer' })),
    changes,
    sheetNames: workbook.SheetNames,
  }
}
