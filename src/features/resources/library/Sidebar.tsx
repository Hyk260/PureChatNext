'use client'

import { Flex, Typography } from 'antd'
import Link from '@/utils/link'
import { useParams, usePathname, useRouter } from '@/utils/navigation'
import { memo } from 'react'

import NavItem from '@/components/NavItem'
import { DOCUMENT_FOLDER_TYPE } from '@/const/resources/fileTypes'
import { useFolderPath } from '@/features/resources/hooks/useFolderPath'
import {
  useFetchKnowledgeBaseList,
  useFetchResources,
  useResourceStore,
} from '@/features/resources/store/resourceStore'
import { Icon } from '@pure/ui'
import { createStaticStyles, cssVar } from 'antd-style'
import { ChevronLeft, FolderIcon } from 'lucide-react'

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
  const pathname = usePathname()
  const { libraryId } = useFolderPath()

  const queryParams = {
    knowledgeBaseId: libraryId,
    parentId: null as string | null,
    showFilesInKnowledgeBase: false,
  }

  useFetchResources(queryParams)
  const folders = useResourceStore((s) => s.resourceList.filter((item) => item.fileType === DOCUMENT_FOLDER_TYPE))

  if (folders.length === 0) {
    return (
      <Flex vertical style={{ padding: 12 }}>
        <Typography.Text type='secondary' style={{ fontSize: 12 }}>
          暂无文件夹
        </Typography.Text>
      </Flex>
    )
  }

  return (
    <Flex vertical gap={1} style={{ paddingInline: 8 }}>
      {folders.map((folder) => {
        const href = `/resources/library/${libraryId}/${folder.slug ?? folder.id}`
        const active = pathname === href || pathname.startsWith(`${href}/`)

        return (
          <Link key={folder.id} href={href} style={{ color: 'inherit', textDecoration: 'none' }}>
            <NavItem active={active} clickable icon={FolderIcon} title={folder.name} />
          </Link>
        )
      })}
    </Flex>
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
    <Flex vertical className={styles.sidebar} style={{ height: '100%' }}>
      <Flex align='center' className={styles.header} gap={8}>
        <Icon icon={ChevronLeft} size={16} style={{ cursor: 'pointer' }} onClick={() => router.push('/resources')} />
        <Typography.Text ellipsis strong>
          {kb?.name ?? '知识库'}
        </Typography.Text>
      </Flex>
      <Flex vertical flex={1} style={{ paddingBlock: 8, overflow: 'auto' }}>
        <LibraryHierarchy />
      </Flex>
    </Flex>
  )
})

LibrarySidebar.displayName = 'LibrarySidebar'

export default LibrarySidebar
