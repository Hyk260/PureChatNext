// @vitest-environment node
import * as xlsx from 'xlsx'
import { describe, expect, it } from 'vitest'

import { editExcelBuffer } from '../editExcel'
import type { ExcelEditError } from '../editExcel'

const workbookBuffer = () => {
  const workbook = xlsx.utils.book_new()
  const sheet = xlsx.utils.aoa_to_sheet([
    ['姓名：徐澳星', '工时'],
    ['项目', { f: '1+1', t: 'n', v: 2 }],
  ])
  sheet['!merges'] = [{ e: { c: 1, r: 0 }, s: { c: 0, r: 0 } }]
  xlsx.utils.book_append_sheet(workbook, sheet, '记录')
  return Buffer.from(xlsx.write(workbook, { bookType: 'xlsx', type: 'buffer' }))
}

describe('editExcelBuffer', () => {
  it('replaces text while preserving formulas and merges', () => {
    const result = editExcelBuffer(workbookBuffer(), '记录.xlsx', [
      { find: '徐澳星', mode: 'substring', replace: '厉飞雨', type: 'replace' },
    ])
    const edited = xlsx.read(result.buffer, { type: 'buffer' })
    expect(edited.Sheets['记录']?.A1.v).toBe('姓名：厉飞雨')
    expect(edited.Sheets['记录']?.B2.f).toBe('1+1')
    expect(edited.Sheets['记录']?.['!merges']).toHaveLength(1)
    expect(result.changes).toEqual([
      { cell: 'A1', from: '姓名：徐澳星', sheet: '记录', to: '姓名：厉飞雨' },
    ])
  })

  it('requires confirmation when replacement has multiple matches', () => {
    const workbook = xlsx.utils.book_new()
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.aoa_to_sheet([['A'], ['A']]), 'Sheet1')
    const input = Buffer.from(xlsx.write(workbook, { bookType: 'xlsx', type: 'buffer' }))
    expect(() => editExcelBuffer(input, 'multi.xlsx', [{ find: 'A', replace: 'B', type: 'replace' }])).toThrowError(
      expect.objectContaining<Partial<ExcelEditError>>({ code: 'AMBIGUOUS_MATCH' })
    )
  })

  it('does not overwrite formulas with set', () => {
    expect(() =>
      editExcelBuffer(workbookBuffer(), '记录.xlsx', [{ cell: 'B2', sheet: '记录', type: 'set', value: 3 }])
    ).toThrowError(expect.objectContaining<Partial<ExcelEditError>>({ code: 'FORMULA_CELL' }))
  })
})
