'use client'

import { ActionIcon, DropdownMenu, Flex, Text } from '@pure/ui'
import { Github } from '@pure/ui/icons'
import type { MenuProps } from '@pure/ui'
import { Box, FileArchive, Link } from 'lucide-react'
import { useMemo } from 'react'
import type { ReactNode } from 'react'

import { useApp } from '@/components/AntdStaticMethods'

const SkillImportLabel = ({ description, title }: { description: string; title: string }) => (
  <Flex className='flex-col gap-0.5'>
    <Text>{title}</Text>
    <Text className='text-xs' type='secondary'>
      {description}
    </Text>
  </Flex>
)

export const SkillImportMenu = ({ children }: { children?: ReactNode }) => {
  const { message } = useApp()

  const items = useMemo<MenuProps['items']>(
    () => [
      {
        icon: <Link size={16} />,
        key: 'url',
        label: <SkillImportLabel description='通过 SKILL.md 的直接链接导入' title='从 URL 导入' />,
        onClick: () => message.info('即将推出'),
      },
      {
        icon: <Github size={16} />,
        key: 'github',
        label: <SkillImportLabel description='从公开的 GitHub 仓库导入' title='从 GitHub 导入' />,
        onClick: () => message.info('即将推出'),
      },
      {
        icon: <FileArchive size={16} />,
        key: 'zip',
        label: <SkillImportLabel description='上传本地 .zip 或 .skill 文件' title='上传 Zip' />,
        onClick: () => message.info('即将推出'),
      },
    ],
    [message]
  )

  return (
    <DropdownMenu items={items} nativeButton placement='bottomRight' popupProps={{ style: { minWidth: 280 } }}>
      {children ?? <ActionIcon icon={Box} size='small' title='添加' />}
    </DropdownMenu>
  )
}
