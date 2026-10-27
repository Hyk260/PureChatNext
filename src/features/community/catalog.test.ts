import { describe, expect, it } from 'vitest'

import { filterCatalogItems, getCategoryCounts, getSkillInstallErrorMessage } from './catalog'

const items = [
  { category: 'code', title: 'TypeScript', author: 'Alice', description: '写代码', identifier: 'demo/ts' },
  { category: 'design', title: 'Design', author: 'Bob', description: '设计', identifier: 'demo/ui' },
]

describe('catalog helpers', () => {
  it('counts categories, empty categories and the complete collection', () => {
    expect(getCategoryCounts(items, ['all', 'code', 'design', 'empty'], 'all')).toEqual({
      all: 2,
      code: 1,
      design: 1,
      empty: 0,
    })
  })

  it('combines categories with trimmed, case-insensitive search fields', () => {
    const fields = (item: (typeof items)[number]) => [item.title, item.author, item.description, item.identifier]
    expect(filterCatalogItems(items, { q: '  ALICE  ' }, fields)).toEqual([items[0]])
    expect(filterCatalogItems(items, { category: 'design', q: 'alice' }, fields)).toEqual([])
    expect(filterCatalogItems(items, { category: null, q: '  ' }, fields)).toEqual(items)
    expect(filterCatalogItems(items, { q: 'demo/ui' }, fields)).toEqual([items[1]])
    expect(filterCatalogItems(items, { q: '写代码' }, fields)).toEqual([items[0]])
  })

  it.each([
    [401, '请先登录后再安装'],
    [409, '已安装'],
    [503, '对象存储未配置，无法安装'],
    [404, '技能不存在'],
    [500, '安装失败'],
  ])('preserves installation status %s', (status, message) => {
    expect(getSkillInstallErrorMessage(Number(status))).toBe(message)
  })
})
