'use client'

import Link from 'next/link'
import { useParams, usePathname, useRouter } from 'next/navigation'
import { memo } from 'react'

import NavItem from '@/components/NavItem'
import { DOCUMENT_FOLDER_TYPE } from '@/const/resources/fileTypes'
import { useFetchKnowledgeBaseList, useFetchResources, useResourceStore } from '@/features/resources/store/resourceStore'
import { Flexbox, Text } from '@lobehub/ui'
import { createStaticStyles, cssVar } from 'antd-style'
import { ChevronLeft, FolderIcon } from 'lucide-react'
import { Icon } from '@lobehub/ui'

const styles = createStaticStyles(({ css }) => ({
  sidebar: css`
    flex: none;
    width: 240px;
    height: 100%;
    background: ${cssVar.colorBgLayout};
    border-inline-end: 1px solid ${cssVar.colorBorderSecondary};
  `,
  header: css`
    padding: 12px 16px;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};
  `,
}))

const LibraryHierarchy = memo(() => {
  const params = useParams<{ id: string; slug?: string[] }>()
  const pathname = usePathname()
  const libraryId = params.id
  const slugParts = params.slug ?? []

  const queryParams = {
    knowledgeBaseId: libraryId,
    parentId: null as string | null,
    showFilesInKnowledgeBase: false,
  }

  useFetchResources(queryParams)
  const folders = useResourceStore((s) =>
    s.resourceList.filter((item) => item.fileType === DOCUMENT_FOLDER_TYPE),
  )

  if (folders.length === 0) {
    return (
      <Flexbox padding={12}>
        <Text fontSize={12} type='secondary'>
          暂无文件夹
        </Text>
      </Flexbox>
    )
  }

  return (
    <Flexbox gap={1} paddingInline={8}>
      {folders.map((folder) => {
        const href = `/resources/library/${libraryId}/${folder.slug ?? folder.id}`
        const active = pathname === href || pathname.startsWith(`${href}/`)

        return (
          <Link key={folder.id} href={href} style={{ color: 'inherit', textDecoration: 'none' }}>
            <NavItem
              active={active}
              clickable
              icon={FolderIcon}
              title={folder.name}
            />
          </Link>
        )
      })}
    </Flexbox>
  )
})

LibraryHierarchy.displayName = 'LibraryHierarchy'

const LibrarySidebar = memo(() => {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const knowledgeBases = useResourceStore((s) => s.knowledgeBases)
  const kb = knowledgeBases.find((item) => item.id === params.id)

  useFetchKnowledgeBaseList()

  return (
    <Flexbox className={styles.sidebar} height='100%'>
      <Flexbox align='center' className={styles.header} gap={8} horizontal>
        <Icon
          icon={ChevronLeft}
          size={16}
          style={{ cursor: 'pointer' }}
          onClick={() => router.push('/resources')}
        />
        <Text ellipsis strong>
          {kb?.name ?? '知识库'}
        </Text>
      </Flexbox>
      <Flexbox flex={1} paddingBlock={8} style={{ overflow: 'auto' }}>
        <LibraryHierarchy />
      </Flexbox>
    </Flexbox>
  )
})

LibrarySidebar.displayName = 'LibrarySidebar'

export default LibrarySidebar
