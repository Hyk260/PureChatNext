export function getCommunityPageData<T>(data: readonly T[], page: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(data.length / pageSize))
  const currentPage = Math.min(Math.max(1, Math.floor(page) || 1), totalPages)

  return {
    currentPage,
    pageData: data.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    totalPages,
  }
}
