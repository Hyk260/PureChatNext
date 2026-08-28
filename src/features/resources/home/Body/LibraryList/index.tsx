'use client'

import { ActionIcon, Button, confirmModal, Text, Flex } from '@pure/ui'
import { useApp } from '@/components/AntdStaticMethods'
import { Plus, Trash2 } from 'lucide-react'
import Link from '@/utils/link'
import { usePathname } from '@/utils/navigation'
import { memo } from 'react'

import NavItem from '@/components/NavItem'
import { useFetchKnowledgeBaseList, useResourceStore } from '@/features/resources/store/resourceStore'

const LibraryList = memo(() => {
  const pathname = usePathname()
  const { message } = useApp()
  const { data: libraries } = useFetchKnowledgeBaseList()
  const createKnowledgeBase = useResourceStore((s) => s.createKnowledgeBase)
  const deleteKnowledgeBase = useResourceStore((s) => s.deleteKnowledgeBase)

  const handleCreate = async () => {
    const name = window.prompt('知识库名称')
    if (!name) return
    try {
      await createKnowledgeBase(name)
      message.success('知识库已创建')
    } catch (err) {
      message.error(err instanceof Error ? err.message : '创建失败')
    }
  }

  return (
    <Flex className='flex-col gap-1 px-2'>
      <Flex className='flex-between px-1'>
        <Text type='secondary' style={{ fontSize: 12 }}>
          知识库
        </Text>
        <ActionIcon icon={Plus} onClick={handleCreate} size='small' title='新建' />
      </Flex>
      {libraries.length === 0 ? (
        <Text type='secondary' style={{ fontSize: 12 }}>
          暂无知识库
        </Text>
      ) : (
        libraries.map((kb) => {
          const href = `/resources/library/${kb.id}`
          const active = pathname.startsWith(href)

          return (
            <Flex className='flex-between' key={kb.id}>
              <Link href={href} style={{ color: 'inherit', flex: 1, textDecoration: 'none' }}>
                <NavItem active={active} clickable title={kb.name} />
              </Link>
              <ActionIcon
                icon={Trash2}
                size='small'
                title='删除'
                onClick={() =>
                  confirmModal({
                    cancelText: '取消',
                    content: '库内文件不会被删除。',
                    okButtonProps: { danger: true },
                    okText: '删除',
                    onOk: () => deleteKnowledgeBase(kb.id),
                    title: '删除此知识库？',
                  })
                }
              />
            </Flex>
          )
        })
      )}
    </Flex>
  )
})

LibraryList.displayName = 'LibraryList'

export default LibraryList
