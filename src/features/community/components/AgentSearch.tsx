'use client'

import { SearchBar } from '@lobehub/ui'
import { usePathname, useRouter, useSearchParams } from '@/utils/navigation'
import { memo, useCallback, useEffect, useState, useTransition } from 'react'

const AgentSearch = memo(() => {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const urlQuery = searchParams.get('q') ?? ''
  const [value, setValue] = useState(urlQuery)
  const [, startTransition] = useTransition()

  useEffect(() => {
    setValue(urlQuery)
  }, [urlQuery])

  const commitQuery = useCallback(
    (nextValue: string) => {
      const next = new URLSearchParams(searchParams.toString())
      const trimmed = nextValue.trim()
      if (trimmed) {
        next.set('q', trimmed)
      } else {
        next.delete('q')
      }
      next.delete('page')
      const query = next.toString()
      startTransition(() => {
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
      })
    },
    [pathname, router, searchParams],
  )

  return (
    <SearchBar
      allowClear
      placeholder='搜索名称、描述或关键词...'
      value={value}
      onChange={(event) => {
        const next = event.target.value
        setValue(next)
        commitQuery(next)
      }}
      onClear={() => {
        setValue('')
        commitQuery('')
      }}
    />
  )
})

AgentSearch.displayName = 'AgentSearch'

export default AgentSearch
