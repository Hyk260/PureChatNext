'use client'

import { Icon, ProviderIcon, Tag, Text, Flexbox } from '@pure/ui'
import { createStaticStyles, cssVar, cx } from 'antd-style'
import { LayoutPanelTop } from 'lucide-react'
import { memo, useCallback, useMemo } from 'react'

import { getModelProviderCounts } from '@/const/community/models'
import { COMMUNITY_PROVIDERS } from '@/const/community/providers'
import { usePathname, useRouter, useSearchParams } from '@/utils/navigation'

const styles = createStaticStyles(({ css }) => ({
  count: css`
    margin-inline-start: auto;
  `,
  item: css`
    cursor: pointer;
    display: flex;
    gap: 10px;
    align-items: center;
    width: 100%;
    padding: 8px 12px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: ${cssVar.colorTextSecondary};
    font-size: 14px;
    text-align: left;
    transition:
      background 0.15s ease,
      color 0.15s ease;

    &:hover {
      background: ${cssVar.colorFillSecondary};
      color: ${cssVar.colorText};
    }

    &:focus-visible {
      outline: 2px solid ${cssVar.colorPrimary};
      outline-offset: -2px;
    }
  `,
  active: css`
    && {
      background: ${cssVar.colorPrimaryBg};
      color: ${cssVar.colorPrimaryText};
    }

    &&:hover {
      background: ${cssVar.colorPrimaryBgHover};
    }
  `,
  root: css`
    position: sticky;
    top: 0;
    flex: none;
    width: 220px;
    max-height: calc(100vh - 120px);
    overflow: auto;
  `,
}))

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
    <Flexbox className={styles.root} gap={4}>
      <button
        className={cx(styles.item, selected === ALL_KEY && styles.active)}
        type='button'
        onClick={() => handleSelect(ALL_KEY)}
      >
        <Icon icon={LayoutPanelTop} size={18} />
        <Text ellipsis>全部</Text>
        {counts.all > 0 ? (
          <Tag
            className={styles.count}
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
            className={cx(styles.item, isActive && styles.active)}
            key={provider.id}
            type='button'
            onClick={() => handleSelect(provider.id)}
          >
            <ProviderIcon provider={provider.id} size={18} type='mono' />
            <Text ellipsis>{provider.name}</Text>
            {count > 0 ? (
              <Tag
                className={styles.count}
                size='small'
                style={{ borderRadius: 12, paddingInline: 6, fontSize: 12, lineHeight: '20px' }}
              >
                {count}
              </Tag>
            ) : null}
          </button>
        )
      })}
    </Flexbox>
  )
})

ModelCategory.displayName = 'ModelCategory'

export default ModelCategory
