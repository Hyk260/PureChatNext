/** Provider endpoint / logo URL, without credentials, query parameters or fragments. */
export const isProviderHttpUrl = (value: string): boolean => {
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && !url.hash && !url.search
  } catch {
    return false
  }
}
