'use client'

import { Icon, ProviderIcon, Tag, Text, Flex } from '@pure/ui'
import { cx } from 'antd-style'
import { LayoutPanelTop } from 'lucide-react'
import { memo, useCallback, useMemo } from 'react'

import Scrollbar from '@/components/Scrollbar'
import { getModelProviderCounts } from '@/const/community/models'
import { COMMUNITY_PROVIDERS } from '@/const/community/providers'
import { usePathname, useRouter, useSearchParams } from '@/utils/navigation'

import { communityCategoryStyles } from './communityCategoryStyles'

const ALL_KEY = 'all'

const ModelCategory = memo(() => {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const selected = searchParams.get('category') ?? ALL_KEY
  const counts = useMemo(() => getModelProviderCounts(), [])

  const handleSelect = useCallback(
    (key: string) => {
      const next = new URLSearchParams(searchParams.toString())
      if (key === ALL_KEY) {
        next.delete('category')
      } else {
        next.set('category', key)
      }
      next.delete('page')
      const query = next.toString()
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    },
    [pathname, router, searchParams]
  )

  return (
    <Flex className={[communityCategoryStyles.root, 'flex-col']}>
      <Scrollbar className='size-full'>
        <Flex className='flex-col gap-1'>
          <button
            className={cx(communityCategoryStyles.item, selected === ALL_KEY && communityCategoryStyles.active)}
            type='button'
            onClick={() => handleSelect(ALL_KEY)}
          >
            <Icon icon={LayoutPanelTop} size={18} />
            <Text ellipsis>全部</Text>
            {counts.all > 0 ? (
              <Tag
                className={communityCategoryStyles.count}
                size='small'
                style={{ borderRadius: 12, paddingInline: 6, fontSize: 12, lineHeight: '20px' }}
              >
                {counts.all}
              </Tag>
            ) : null}
          </button>
          {COMMUNITY_PROVIDERS.map((provider) => {
            const isActive = selected === provider.id
            const count = counts[provider.id] ?? 0
            return (
              <button
                className={cx(communityCategoryStyles.item, isActive && communityCategoryStyles.active)}
                key={provider.id}
                type='button'
                onClick={() => handleSelect(provider.id)}
              >
                <ProviderIcon provider={provider.id} size={18} type='mono' />
                <Text ellipsis>{provider.name}</Text>
                {count > 0 ? (
                  <Tag
                    className={communityCategoryStyles.count}
                    size='small'
                    style={{ borderRadius: 12, paddingInline: 6, fontSize: 12, lineHeight: '20px' }}
                  >
                    {count}
                  </Tag>
                ) : null}
              </button>
            )
          })}
        </Flex>
      </Scrollbar>
    </Flex>
  )
})

ModelCategory.displayName = 'ModelCategory'

export default ModelCategory
