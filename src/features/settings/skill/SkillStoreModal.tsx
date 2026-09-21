'use client'

import {
  ActionIcon,
  Avatar,
  Block,
  Button,
  DropdownMenu,
  Empty,
  Flex,
  Grid,
  Modal,
  SearchBar,
  Text,
  stopPropagation,
} from '@pure/ui'
import type { MenuProps } from '@pure/ui'
import { Pagination, Segmented } from 'antd'
import { Box, Ellipsis, Loader2, Plus } from 'lucide-react'
import { memo, useCallback, useEffect, useMemo, useState } from 'react'

import { useApp } from '@/components/AntdStaticMethods'
import Scrollbar from '@/components/Scrollbar'
import { githubAssetAvatar } from '@/const/community/githubAssetUrl'
import { COMMUNITY_SKILLS, filterCommunitySkills } from '@/const/community/skills'
import SkillDetailModal from '@/features/community/components/SkillDetailModal'
import { getCommunityPageData } from '@/features/community/pagination'
import type { DiscoverSkillItem } from '@/features/community/types'
import { confirmUninstallSkill, deleteUserSkill } from '@/features/community/uninstallSkill'

import { SkillImportMenu } from './skillImportMenu'

const STORE_PAGE_SIZE = 12
const STORE_TAB_OPTIONS = [
  { label: '技能', value: 'skill' },
  { label: 'MCP', value: 'mcp' },
] as const

type StoreTab = (typeof STORE_TAB_OPTIONS)[number]['value']

type InstalledSkillRef = {
  id: string
  identifier: string
}

const getSkillInstallErrorMessage = (status: number) => {
  if (status === 401) return '请先登录后再安装'
  if (status === 409) return '已安装'
  if (status === 503) return '对象存储未配置，无法安装'
  if (status === 404) return '技能不存在'
  return '安装失败'
}

export interface SkillStoreModalProps {
  installedSkills: InstalledSkillRef[]
  onClose: () => void
  onInstalled?: (skillId?: string) => void
  onUninstalled?: () => void
  open: boolean
}

const StoreSkillRow = memo(function StoreSkillRow({
  installing,
  installedId,
  item,
  uninstalling,
  onInstall,
  onOpenDetail,
  onUninstall,
}: {
  installing: boolean
  installedId: string | null
  item: DiscoverSkillItem
  onInstall: () => void
  onOpenDetail: (identifier: string) => void
  onUninstall: (skillId: string) => void
  uninstalling: boolean
}) {
  const menuItems = useMemo<MenuProps['items']>(
    () => [
      {
        danger: true,
        disabled: uninstalling,
        key: 'uninstall',
        label: '卸载',
        onClick: () => {
          if (!installedId) return
          onUninstall(installedId)
        },
      },
    ],
    [installedId, onUninstall, uninstalling]
  )

  return (
    <Block
      clickable
      className='flex items-center gap-3 p-3'
      variant='outlined'
      onClick={() => onOpenDetail(item.identifier)}
    >
      <Avatar avatar={githubAssetAvatar(item.icon, item.name)} background='transparent' shape='square' size={40} style={{ flex: 'none' }} />
      <Flex className='flex-col min-w-0 flex-1'>
        <Text ellipsis>{item.name}</Text>
        <Text ellipsis type='secondary'>
          {item.description}
        </Text>
      </Flex>
      {installedId ? (
        <span onClick={stopPropagation} onKeyDown={stopPropagation}>
          <DropdownMenu items={menuItems} nativeButton placement='bottomRight'>
            <ActionIcon disabled={uninstalling} icon={Ellipsis} size='small' title='更多' />
          </DropdownMenu>
        </span>
      ) : (
        <span onClick={stopPropagation} onKeyDown={stopPropagation}>
          <ActionIcon
            disabled={installing}
            icon={installing ? Loader2 : Plus}
            size='small'
            spin={installing}
            title={installing ? '安装中' : '安装'}
            onClick={onInstall}
          />
        </span>
      )}
    </Block>
  )
})

const SkillStoreModal = memo<SkillStoreModalProps>(({ installedSkills, onClose, onInstalled, onUninstalled, open }) => {
  const { message } = useApp()
  const [tab, setTab] = useState<StoreTab>('skill')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [selectedIdentifier, setSelectedIdentifier] = useState<string | null>(null)
  const [installingIdentifier, setInstallingIdentifier] = useState<string | null>(null)
  const [uninstallingId, setUninstallingId] = useState<string | null>(null)

  const installedIdByIdentifier = useMemo(() => {
    const map = new Map<string, string>()
    for (const skill of installedSkills) map.set(skill.identifier, skill.id)
    return map
  }, [installedSkills])

  const filtered = useMemo(() => filterCommunitySkills(COMMUNITY_SKILLS, { q: query }), [query])
  const { currentPage, pageData } = useMemo(
    () => getCommunityPageData(filtered, page, STORE_PAGE_SIZE),
    [filtered, page]
  )

  const selectedSkill = useMemo(
    () => COMMUNITY_SKILLS.find((item) => item.identifier === selectedIdentifier) ?? null,
    [selectedIdentifier]
  )

  useEffect(() => {
    if (open) return
    setTab('skill')
    setQuery('')
    setPage(1)
    setSelectedIdentifier(null)
  }, [open])

  const handleInstall = useCallback(
    async (identifier: string) => {
      if (installingIdentifier) return
      setInstallingIdentifier(identifier)
      try {
        const response = await fetch('/api/community/skills/install', {
          body: JSON.stringify({ identifier }),
          headers: { 'Content-Type': 'application/json' },
          method: 'POST',
        })
        if (response.status === 409) {
          message.info('已安装')
          onInstalled?.()
          return
        }
        if (!response.ok) {
          message.error(getSkillInstallErrorMessage(response.status))
          return
        }
        const payload = (await response.json()) as { id?: string }
        message.success('已安装')
        onInstalled?.(payload.id)
      } catch {
        message.error('安装失败')
      } finally {
        setInstallingIdentifier(null)
      }
    },
    [installingIdentifier, message, onInstalled]
  )

  const handleUninstall = useCallback(
    (skillId: string) => {
      if (uninstallingId) return
      confirmUninstallSkill(async () => {
        setUninstallingId(skillId)
        try {
          await deleteUserSkill(skillId)
          message.success('已卸载')
          onUninstalled?.()
        } catch {
          message.error('卸载失败')
        } finally {
          setUninstallingId(null)
        }
      })
    },
    [message, onUninstalled, uninstallingId]
  )

  return (
    <>
      <Modal
        footer={null}
        open={open}
        styles={{
          body: {
            display: 'flex',
            flexDirection: 'column',
            maxHeight: 'calc(100dvh - 160px)',
            minHeight: 0,
            overflow: 'hidden',
          },
        }}
        title='技能商店'
        width={880}
        onCancel={onClose}
      >
        <Flex className='flex-col gap-3 min-h-0 flex-1'>
          <Flex className='items-center gap-2'>
            <Segmented
              block
              options={[...STORE_TAB_OPTIONS]}
              style={{ flex: 1 }}
              value={tab}
              onChange={(value) => setTab(value as StoreTab)}
            />
            <SkillImportMenu>
              <Button icon={<Box size={16} />}>添加</Button>
            </SkillImportMenu>
          </Flex>

          {tab === 'mcp' ? (
            <Flex className='flex-1 items-center justify-center min-h-[320px]'>
              <Empty description='即将推出' />
            </Flex>
          ) : (
            <>
              <SearchBar
                placeholder='搜索技能名称或关键词，按回车键搜索...'
                value={query}
                onInputChange={(value) => {
                  setQuery(value)
                  setPage(1)
                }}
              />
              {pageData.length === 0 ? (
                <Flex className='flex-1 items-center justify-center min-h-[280px]'>
                  <Empty description='暂无匹配技能' />
                </Flex>
              ) : (
                <Scrollbar style={{ flex: 1, minHeight: 0 }}>
                  <Grid gap={12} rows={2} width='100%'>
                    {pageData.map((item) => {
                      const installedId = installedIdByIdentifier.get(item.identifier) ?? null
                      return (
                        <StoreSkillRow
                          installing={installingIdentifier === item.identifier}
                          installedId={installedId}
                          item={item}
                          key={item.identifier}
                          uninstalling={uninstallingId === installedId}
                          onInstall={() => void handleInstall(item.identifier)}
                          onOpenDetail={setSelectedIdentifier}
                          onUninstall={handleUninstall}
                        />
                      )
                    })}
                  </Grid>
                </Scrollbar>
              )}
              {filtered.length > STORE_PAGE_SIZE ? (
                <Pagination
                  align='end'
                  current={currentPage}
                  pageSize={STORE_PAGE_SIZE}
                  showSizeChanger={false}
                  total={filtered.length}
                  onChange={setPage}
                />
              ) : null}
            </>
          )}
        </Flex>
      </Modal>
      <SkillDetailModal
        open={selectedIdentifier !== null}
        skill={selectedSkill}
        onClose={() => setSelectedIdentifier(null)}
        onInstalled={onInstalled}
        onUninstalled={onUninstalled}
      />
    </>
  )
})

SkillStoreModal.displayName = 'SkillStoreModal'

export default SkillStoreModal
