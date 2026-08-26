'use client'

import { Pagination as AntPagination } from 'antd'
import { createStaticStyles } from 'antd-style'
import { memo, useCallback } from 'react'

import { usePathname, useRouter, useSearchParams } from '@/utils/navigation'

const SCROLL_VIEWPORT_CLASS = 'community-scroll-viewport'
const prefixCls = 'ant'

const styles = createStaticStyles(({ css, cssVar }) => ({
  page: css`
    .${prefixCls}-pagination-item-active {
      border-color: ${cssVar.colorFillSecondary};
      background: ${cssVar.colorFillSecondary};

      &:hover {
        border-color: ${cssVar.colorFill};
        background: ${cssVar.colorFill};
      }
    }
  `,
}))

export interface AgentPaginationProps {
  currentPage: number
  pageSize: number
  total: number
}

const AgentPagination = memo<AgentPaginationProps>(({ currentPage, pageSize, total }) => {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const handlePageChange = useCallback(
    (newPage: number) => {
      const next = new URLSearchParams(searchParams.toString())
      if (newPage <= 1) {
        next.delete('page')
      } else {
        next.set('page', String(newPage))
      }
      const query = next.toString()
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })

      const scrollableElement = document?.querySelector(`.${SCROLL_VIEWPORT_CLASS}`)
      scrollableElement?.scrollTo({ behavior: 'smooth', top: 0 })
    },
    [pathname, router, searchParams]
  )

  if (total <= pageSize) return null

  return (
    <AntPagination
      className={styles.page}
      current={currentPage}
      pageSize={pageSize}
      showSizeChanger={false}
      style={{ alignSelf: 'flex-end' }}
      total={total}
      onChange={handlePageChange}
    />
  )
})

AgentPagination.displayName = 'AgentPagination'

export default AgentPagination
