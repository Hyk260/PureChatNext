'use client'

import { Avatar, Button, Flex, Icon, Modal, Tag, Text } from '@pure/ui'
import { Collapse } from 'antd'
import { createStaticStyles, cssVar } from 'antd-style'
import { DotIcon } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { memo, useCallback, useEffect, useState } from 'react'

import { useApp } from '@/components/AntdStaticMethods'
import { githubAssetAvatar } from '@/const/community/githubAssetUrl'
import { SKILL_CATEGORY_LABELS } from '@/const/community/skills'
import MessageMarkdown from '@/features/chat/MessageMarkdown'
import type { DiscoverSkillItem } from '@/features/community/types'
import { confirmUninstallSkill, deleteUserSkill } from '@/features/community/uninstallSkill'
import { useSession } from '@/libs/better-auth/client'

const styles = createStaticStyles(({ css }) => ({
  meta: css`
    font-size: 13px;
    color: ${cssVar.colorTextDescription};
  `,
  sectionTitle: css`
    margin: 0;
    font-size: 15px;
    font-weight: 600;
  `,
  tag: css`
    border-radius: 4px;
  `,
}))

type ReadmeState = { error: true } | { loading: true } | { markdown: string }

type InstalledSkillRef = {
  id: string
  identifier: string
}

const readmeCache = new Map<string, string>()
const readmeInflight = new Map<string, Promise<string>>()
const installedIdCache = new Map<string, string>()

const getInstallErrorMessage = (status: number) => {
  if (status === 401) return '请先登录后再安装'
  if (status === 409) return '已安装'
  if (status === 503) return '对象存储未配置，无法安装'
  if (status === 404) return '技能不存在'
  return '安装失败'
}

const findInstalledSkillId = (items: InstalledSkillRef[], identifier: string) =>
  items.find((item) => item.identifier === identifier)?.id ?? null

const resolveInstalledId = (
  isLoggedIn: boolean,
  identifier: string | undefined,
  fetched: { id: string | null; identifier: string } | null
) => {
  if (!isLoggedIn || !identifier) return null
  if (fetched?.identifier === identifier) return fetched.id
  return installedIdCache.get(identifier) ?? null
}

const rememberInstalledSkills = (items: InstalledSkillRef[]) => {
  installedIdCache.clear()
  for (const item of items) installedIdCache.set(item.identifier, item.id)
}

const fetchInstalledSkills = async (signal?: AbortSignal) => {
  const response = await fetch('/api/user/skills', { signal })
  if (!response.ok) throw new Error('installed')
  return (await response.json()) as InstalledSkillRef[]
}

const loadSkillReadme = (identifier: string) => {
  const cached = readmeCache.get(identifier)
  if (cached) return Promise.resolve(cached)

  const inflight = readmeInflight.get(identifier)
  if (inflight) return inflight

  const request = fetch(`/api/community/skills/${encodeURIComponent(identifier)}/readme`)
    .then(async (response) => {
      if (!response.ok) throw new Error('readme')
      const payload = (await response.json()) as { markdown?: string }
      if (!payload.markdown) throw new Error('readme')
      readmeCache.set(identifier, payload.markdown)
      return payload.markdown
    })
    .finally(() => {
      readmeInflight.delete(identifier)
    })

  readmeInflight.set(identifier, request)
  return request
}

export interface SkillDetailModalProps {
  onClose: () => void
  onInstalled?: (skillId?: string) => void
  onUninstalled?: () => void
  open: boolean
  skill: DiscoverSkillItem | null
}

const SkillReadme = ({ identifier }: { identifier: string }) => {
  const [readme, setReadme] = useState<ReadmeState>(() => {
    const cached = readmeCache.get(identifier)
    return cached ? { markdown: cached } : { loading: true }
  })

  useEffect(() => {
    if (readmeCache.has(identifier)) return

    let cancelled = false
    void loadSkillReadme(identifier)
      .then((markdown) => {
        if (!cancelled) setReadme({ markdown })
      })
      .catch(() => {
        if (!cancelled) setReadme({ error: true })
      })
    return () => {
      cancelled = true
    }
  }, [identifier])

  if ('loading' in readme) return <Text type='secondary'>正在加载…</Text>
  if ('error' in readme) return <Text type='secondary'>暂时无法加载 SKILL.md</Text>
  return <MessageMarkdown text={readme.markdown} />
}

const SkillActionButton = ({
  installedId,
  installing,
  isLoggedIn,
  sessionPending,
  signInHref,
  uninstalling,
  onInstall,
  onUninstall,
}: {
  installedId: string | null
  installing: boolean
  isLoggedIn: boolean
  sessionPending: boolean
  signInHref: string
  uninstalling: boolean
  onInstall: () => void
  onUninstall: () => void
}) => {
  if (sessionPending) {
    return (
      <Button disabled type='primary'>
        安装
      </Button>
    )
  }
  if (!isLoggedIn) {
    return (
      <Link href={signInHref}>
        <Button type='primary'>登录后安装</Button>
      </Link>
    )
  }
  if (installedId) {
    return (
      <Button danger disabled={uninstalling} loading={uninstalling} onClick={onUninstall}>
        卸载
      </Button>
    )
  }
  return (
    <Button disabled={installing} loading={installing} type='primary' onClick={onInstall}>
      安装
    </Button>
  )
}

const SkillDetailModal = memo<SkillDetailModalProps>(({ onClose, onInstalled, onUninstalled, open, skill }) => {
  const { message } = useApp()
  const { data: session, isPending: sessionPending } = useSession()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [installing, setInstalling] = useState(false)
  const [uninstalling, setUninstalling] = useState(false)
  const [fetchedInstall, setFetchedInstall] = useState<{ id: string | null; identifier: string } | null>(null)

  const isLoggedIn = Boolean(session?.user)
  const identifier = skill?.identifier
  const installedId = resolveInstalledId(isLoggedIn, identifier, fetchedInstall)
  const search = searchParams.toString()
  const callbackUrl = search ? `${pathname}?${search}` : pathname
  const signInHref = `/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`

  useEffect(() => {
    if (!identifier || sessionPending || !isLoggedIn) return

    const controller = new AbortController()
    void fetchInstalledSkills(controller.signal)
      .then((items) => {
        rememberInstalledSkills(items)
        setFetchedInstall({ id: installedIdCache.get(identifier) ?? null, identifier })
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
      })
    return () => controller.abort()
  }, [identifier, isLoggedIn, sessionPending])

  const handleInstall = useCallback(async () => {
    if (!skill || installing) return
    setInstalling(true)
    try {
      const response = await fetch('/api/community/skills/install', {
        body: JSON.stringify({ identifier: skill.identifier }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      })
      if (response.status === 409) {
        let foundId: string | null = null
        try {
          const items = await fetchInstalledSkills()
          rememberInstalledSkills(items)
          foundId = findInstalledSkillId(items, skill.identifier)
          setFetchedInstall({ id: foundId, identifier: skill.identifier })
        } catch {
          // 409 already means installed; list refresh is best-effort
        }
        message.info('已安装')
        onInstalled?.(foundId ?? undefined)
        return
      }
      if (!response.ok) {
        message.error(getInstallErrorMessage(response.status))
        return
      }
      const payload = (await response.json()) as { id?: string }
      if (payload.id) {
        installedIdCache.set(skill.identifier, payload.id)
        setFetchedInstall({ id: payload.id, identifier: skill.identifier })
      }
      message.success('已安装，可在设置中查看')
      onInstalled?.(payload.id)
    } catch {
      message.error('安装失败')
    } finally {
      setInstalling(false)
    }
  }, [installing, message, onInstalled, skill])

  const handleUninstall = useCallback(() => {
    if (!skill || !installedId || uninstalling) return
    confirmUninstallSkill(async () => {
      setUninstalling(true)
      try {
        await deleteUserSkill(installedId)
        installedIdCache.delete(skill.identifier)
        setFetchedInstall({ id: null, identifier: skill.identifier })
        message.success('已卸载')
        onUninstalled?.()
      } catch {
        message.error('卸载失败')
      } finally {
        setUninstalling(false)
      }
    })
  }, [installedId, message, onUninstalled, skill, uninstalling])

  if (!skill) return null

  return (
    <Modal
      allowFullscreen
      footer={null}
      open={open}
      styles={{ body: { maxHeight: 'calc(100dvh - 180px)', overflow: 'auto' } }}
      title={null}
      width={760}
      onCancel={onClose}
    >
      <Flex className='flex-col gap-4'>
        <Flex className='justify-between items-center gap-4'>
          <Flex className='items-start gap-3 overflow-hidden'>
            <Avatar
              avatar={githubAssetAvatar(skill.icon, skill.name)}
              background='transparent'
              shape='square'
              size={56}
              style={{ flex: 'none' }}
            />
            <Flex className='flex-col gap-1 overflow-hidden'>
              <Text as='h2' ellipsis style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>
                {skill.name}
              </Text>
              <Flex className='mt-1 flex-wrap gap-1'>
                <Tag size='small'>{SKILL_CATEGORY_LABELS[skill.category]}</Tag>
                {skill.tags?.slice(0, 3).map((tag) => (
                  <Tag key={tag} size='small'>
                    {tag}
                  </Tag>
                ))}
              </Flex>
            </Flex>
          </Flex>
          <SkillActionButton
            installedId={installedId}
            installing={installing}
            isLoggedIn={isLoggedIn}
            sessionPending={sessionPending}
            signInHref={signInHref}
            uninstalling={uninstalling}
            onInstall={() => void handleInstall()}
            onUninstall={handleUninstall}
          />
        </Flex>

        <Flex className='items-center gap-3 flex-wrap' style={{ color: cssVar.colorTextDescription }}>
          <span className={styles.meta}>{skill.author}</span>
          {skill.homepage ? (
            <>
              <Icon icon={DotIcon} size={8} />
              <a
                className={`${styles.meta} hover:underline`}
                href={skill.homepage}
                rel='noopener noreferrer'
                target='_blank'
              >
                主页
              </a>
            </>
          ) : null}
        </Flex>

        {skill.description ? (
          <Flex className='flex-col gap-3'>
            <Text as='h3' className={styles.sectionTitle}>
              关于
            </Text>
            <Text as='p' className='m-0 leading-relaxed' type='secondary'>
              {skill.description}
            </Text>
          </Flex>
        ) : null}

        <Collapse
          defaultActiveKey={['skill']}
          expandIconPlacement='end'
          items={[
            {
              children: (
                <div className='max-h-[40vh] min-h-40 overflow-auto'>
                  <SkillReadme key={skill.identifier} identifier={skill.identifier} />
                </div>
              ),
              key: 'skill',
              label: 'SKILL.md',
            },
          ]}
        />

        {skill.tags && skill.tags.length > 0 ? (
          <Flex className='flex-col gap-2'>
            <Text as='h3' className={styles.sectionTitle}>
              标签
            </Text>
            <Flex className='flex-wrap gap-2'>
              {skill.tags.map((tag) => (
                <Tag className={styles.tag} key={tag} size='small'>
                  {tag}
                </Tag>
              ))}
            </Flex>
          </Flex>
        ) : null}
      </Flex>
    </Modal>
  )
})

SkillDetailModal.displayName = 'SkillDetailModal'

export default SkillDetailModal
