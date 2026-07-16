'use client'

import { ActionIcon, Button, Flexbox, Text } from '@lobehub/ui'
import { App } from 'antd'
import { Plus, Trash2 } from 'lucide-react'
import Link from '@/utils/link'
import { usePathname } from '@/utils/navigation'
import { memo } from 'react'

import NavItem from '@/components/NavItem'
import { useFetchKnowledgeBaseList, useResourceStore } from '@/features/resources/store/resourceStore'

const LibraryList = memo(() => {
  const pathname = usePathname()
  const { message } = App.useApp()
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
    <Flexbox gap={4} paddingInline={8}>
      <Flexbox align='center' horizontal justify='space-between' paddingInline={4}>
        <Text fontSize={12} type='secondary'>
          知识库
        </Text>
        <ActionIcon icon={Plus} onClick={() => void handleCreate()} size='small' title='新建' />
      </Flexbox>
      {libraries.length === 0 ? (
        <Text fontSize={12} type='secondary'>
          暂无知识库
        </Text>
      ) : (
        libraries.map((kb) => {
          const href = `/resources/library/${kb.id}`
          const active = pathname.startsWith(href)

          return (
            <Flexbox key={kb.id} align='center' horizontal justify='space-between'>
              <Link href={href} style={{ color: 'inherit', flex: 1, textDecoration: 'none' }}>
                <NavItem active={active} clickable title={kb.name} />
              </Link>
              <ActionIcon
                icon={Trash2}
                size='small'
                title='删除'
                onClick={() => {
                  if (window.confirm('确定删除此知识库？库内文件不会被删除。')) {
                    void deleteKnowledgeBase(kb.id)
                  }
                }}
              />
            </Flexbox>
          )
        })
      )}
    </Flexbox>
  )
})

LibraryList.displayName = 'LibraryList'

export default LibraryList
