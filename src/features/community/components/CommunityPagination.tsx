'use client'

import { Pagination as AntPagination } from 'antd'
import { createStaticStyles } from 'antd-style'
import { memo, useCallback } from 'react'

import { usePathname, useRouter, useSearchParams } from '@/utils/navigation'

const COMMUNITY_SCROLL_VIEWPORT_CLASS = 'community-scroll-viewport'
const ANT_PREFIX_CLASS = 'ant'

const communityPaginationStyles = createStaticStyles(({ css, cssVar }) => ({
  page: css`
    .${ANT_PREFIX_CLASS}-pagination-item-active {
      border-color: ${cssVar.colorFillSecondary};
      background: ${cssVar.colorFillSecondary};

      &:hover {
        border-color: ${cssVar.colorFill};
        background: ${cssVar.colorFill};
      }
    }
  `,
}))

export interface CommunityPaginationProps {
  currentPage: number
  pageSize: number
  total: number
}

const CommunityPagination = memo<CommunityPaginationProps>(({ currentPage, pageSize, total }) => {
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

      const scrollableElement = document?.querySelector(`.${COMMUNITY_SCROLL_VIEWPORT_CLASS}`)
      scrollableElement?.scrollTo({ behavior: 'smooth', top: 0 })
    },
    [pathname, router, searchParams]
  )

  if (total <= pageSize) return null

  return (
    <AntPagination
      className={communityPaginationStyles.page}
      current={currentPage}
      pageSize={pageSize}
      showSizeChanger={false}
      style={{ alignSelf: 'flex-end' }}
      total={total}
      onChange={handlePageChange}
    />
  )
})

CommunityPagination.displayName = 'CommunityPagination'

export default CommunityPagination
