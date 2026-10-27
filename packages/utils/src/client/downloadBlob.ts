/** Download caller-prepared data; networking and filenames remain the caller's responsibility. */
export function downloadBlob(blob: Blob, filename: string): void {
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  try {
    link.download = filename
    link.href = url
    link.style.display = 'none'
    document.body.append(link)
    link.click()
  } finally {
    link.remove()
    URL.revokeObjectURL(url)
  }
}
