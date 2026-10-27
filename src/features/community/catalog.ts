type CategoryItem<Category extends string> = { category: Category }

export function getCategoryCounts<Category extends string>(
  items: readonly CategoryItem<Category>[],
  categories: readonly Category[],
  allCategory: Category
): Record<Category, number> {
  const counts = Object.fromEntries(categories.map((key) => [key, 0])) as Record<Category, number>
  for (const item of items) counts[item.category] += 1
  counts[allCategory] = items.length
  return counts
}

export function filterCatalogItems<Item extends CategoryItem<string>>(
  items: readonly Item[],
  options: { category?: string | null; q?: string | null },
  getSearchFields: (item: Item) => readonly unknown[]
): Item[] {
  const category = options.category ?? 'all'
  const query = options.q?.trim().toLowerCase() ?? ''
  return items.filter((item) => {
    if (category !== 'all' && item.category !== category) return false
    if (!query) return true
    return getSearchFields(item).join(' ').toLowerCase().includes(query)
  })
}

export function getSkillInstallErrorMessage(status: number): string {
  if (status === 401) return '请先登录后再安装'
  if (status === 409) return '已安装'
  if (status === 503) return '对象存储未配置，无法安装'
  if (status === 404) return '技能不存在'
  return '安装失败'
}
