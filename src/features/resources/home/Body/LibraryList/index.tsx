'use client'


import { toast } from '@lobehub/ui'
import { ActionIcon, Button, confirmModal, Text, Flex } from '@pure/ui'
import { Plus, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { memo } from 'react'

import NavItem from '@/components/NavItem'
import { useFetchKnowledgeBaseList, useResourceStore } from '@/features/resources/store/resourceStore'

const LibraryList = memo(() => {
  const pathname = usePathname()
  const { data: libraries } = useFetchKnowledgeBaseList()
  const createKnowledgeBase = useResourceStore((s) => s.createKnowledgeBase)
  const deleteKnowledgeBase = useResourceStore((s) => s.deleteKnowledgeBase)

  const handleCreate = async () => {
    const name = window.prompt('知识库名称')
    if (!name) return
    try {
      await createKnowledgeBase(name)
      toast.success('知识库已创建')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '创建失败')
    }
  }

  return (
    <Flex className='flex-col gap-1 px-2'>
      <Flex className='flex-between px-1'>
        <Text className='text-[12px]' type='secondary'>
          知识库
        </Text>
        <ActionIcon icon={Plus} onClick={handleCreate} size='small' title='新建' />
      </Flex>
      {libraries.length === 0 ? (
        <Text className='text-[12px]' type='secondary'>
          暂无知识库
        </Text>
      ) : (
        libraries.map((kb) => {
          const href = `/resources/library/${kb.id}`
          const active = pathname.startsWith(href)

          return (
            <Flex className='flex-between' key={kb.id}>
              <Link className='flex-1 text-inherit no-underline' href={href}>
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
