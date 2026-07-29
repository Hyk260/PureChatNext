'use client'

import { ActionIcon, Text } from '@pure/ui'
import { Flex, Button } from 'antd'
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
    <Flex vertical gap={4} style={{ paddingInline: 8 }}>
      <Flex align='center' justify='space-between' style={{ paddingInline: 4 }}>
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
            <Flex key={kb.id} align='center' justify='space-between'>
              <Link href={href} style={{ color: 'inherit', flex: 1, textDecoration: 'none' }}>
                <NavItem active={active} clickable title={kb.name} />
              </Link>
              <ActionIcon
                icon={Trash2}
                size='small'
                title='删除'
                onClick={() => {
                  if (window.confirm('确定删除此知识库？库内文件不会被删除。')) {
                    deleteKnowledgeBase(kb.id)
                  }
                }}
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
