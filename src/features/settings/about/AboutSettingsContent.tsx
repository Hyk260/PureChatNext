'use client'

import { ActionIcon, Block, Button, copyToClipboard, Flex, Github, PureChatMark, Tag, Text } from '@pure/ui'
import { Divider } from 'antd'
import { createStaticStyles, cssVar } from 'antd-style'
import { Copy } from 'lucide-react'
import { Fragment } from 'react'
import type { ReactNode } from 'react'

import { useApp } from '@/components/AntdStaticMethods'
import {
  SITE_DEFAULT_URL,
  SITE_DESCRIPTION,
  SITE_DISCUSSIONS_URL,
  SITE_DOCS_URL,
  SITE_ISSUES_URL,
  SITE_LICENSE_URL,
  SITE_NAME,
  SITE_RELEASES_URL,
  SITE_REPOSITORY_SLUG,
  SITE_REPOSITORY_URL,
} from '@/const/site'
import { CURRENT_VERSION } from '@/const/version'
import { SettingRow } from '@/features/settings/profile/components/SettingRow'
import Link from '@/utils/link'

const VERSION_LABEL = `v${CURRENT_VERSION}`
const WEBSITE_HOST = SITE_DEFAULT_URL.replace(/^https:\/\//, '')
const DOCS_HOST = SITE_DOCS_URL.replace(/^https:\/\//, '')

const styles = createStaticStyles(({ css }) => ({
  brand: css`
    min-width: 0;
  `,
  description: css`
    margin: 0;
    font-size: 13px;
    line-height: 1.6;
  `,
  mark: css`
    display: flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    background: ${cssVar.colorFillSecondary};
    border-radius: 12px;
  `,
  name: css`
    font-size: 18px;
    font-weight: 600;
    line-height: 1.3;
  `,
  sectionTitle: css`
    padding-block: 16px 0;
    padding-inline: 16px;
    font-size: 16px;
    font-weight: 600;
  `,
}))

function ExternalLink({ children, href }: { children: ReactNode; href: string }) {
  return (
    <a className='text-inherit no-underline' href={href} rel='noreferrer' target='_blank'>
      {children}
    </a>
  )
}

function OpenAction({ href, label }: { href: string; label: string }) {
  return (
    <ExternalLink href={href}>
      <Text style={{ cursor: 'pointer', fontSize: 13 }}>{label}</Text>
    </ExternalLink>
  )
}

function InternalAction({ href, label }: { href: string; label: string }) {
  return (
    <Link className='text-inherit no-underline' href={href}>
      <Text style={{ cursor: 'pointer', fontSize: 13 }}>{label}</Text>
    </Link>
  )
}

function InfoSection({
  rows,
  title,
}: {
  rows: { action?: ReactNode; key: string; label: string; value: ReactNode }[]
  title: string
}) {
  return (
    <Block variant='filled'>
      <Text className={styles.sectionTitle}>{title}</Text>
      <Flex className='flex-col px-4'>
        {rows.map((row, index) => (
          <Fragment key={row.key}>
            {index > 0 ? <Divider style={{ margin: 0 }} /> : null}
            <SettingRow action={row.action} label={row.label}>
              {row.value}
            </SettingRow>
          </Fragment>
        ))}
      </Flex>
    </Block>
  )
}

export function AboutSettingsContent() {
  const { message } = useApp()

  const handleCopyVersion = async () => {
    await copyToClipboard(VERSION_LABEL)
    message.success('已复制版本号')
  }

  return (
    <Flex className='flex-col gap-6 py-[24px_64px] px-6 w-full'>
      <Block padding={16} variant='filled'>
        <Flex className='flex-between-wrap '>
          <Flex className={[styles.brand, 'flex-row items-center gap-3']}>
            <div className={styles.mark}>
              <PureChatMark size={28} />
            </div>
            <Flex className='flex-col gap-1 min-w-0'>
              <Flex className='flex-row items-center gap-2'>
                <Text className={styles.name}>{SITE_NAME}</Text>
                <Tag size='small'>{VERSION_LABEL}</Tag>
              </Flex>
              <Text className={styles.description} type='secondary'>
                {SITE_DESCRIPTION}
              </Text>
            </Flex>
          </Flex>
          <Button
            icon={<Github size={16} />}
            onClick={() => window.open(SITE_REPOSITORY_URL, '_blank', 'noopener,noreferrer')}
          >
            GitHub
          </Button>
        </Flex>
      </Block>

      <InfoSection
        title='应用信息'
        rows={[
          {
            action: <ActionIcon icon={Copy} size='small' title='复制版本号' onClick={() => void handleCopyVersion()} />,
            key: 'version',
            label: '版本',
            value: <Text>{VERSION_LABEL}</Text>,
          },
          {
            action: <OpenAction href={SITE_LICENSE_URL} label='查看协议' />,
            key: 'license',
            label: '开源协议',
            value: <Text>MIT</Text>,
          },
          {
            action: <OpenAction href={SITE_DEFAULT_URL} label='访问官网' />,
            key: 'website',
            label: '官网',
            value: <Text>{WEBSITE_HOST}</Text>,
          },
          {
            action: <OpenAction href={SITE_DOCS_URL} label='打开文档' />,
            key: 'docs',
            label: '文档',
            value: <Text>{DOCS_HOST}</Text>,
          },
        ]}
      />

      <InfoSection
        title='社区与源码'
        rows={[
          {
            action: <OpenAction href={SITE_REPOSITORY_URL} label='打开仓库' />,
            key: 'github',
            label: 'GitHub',
            value: (
              <ExternalLink href={SITE_REPOSITORY_URL}>
                <Flex className='flex-row items-center gap-2'>
                  <Github size={16} />
                  <Text>{SITE_REPOSITORY_SLUG}</Text>
                </Flex>
              </ExternalLink>
            ),
          },
          {
            action: <OpenAction href={SITE_RELEASES_URL} label='查看发布' />,
            key: 'releases',
            label: '发布说明',
            value: <Text type='secondary'>GitHub Releases</Text>,
          },
          {
            action: <OpenAction href={SITE_ISSUES_URL} label='提交问题' />,
            key: 'issues',
            label: '问题反馈',
            value: <Text type='secondary'>GitHub Issues</Text>,
          },
          {
            action: <OpenAction href={SITE_DISCUSSIONS_URL} label='参与讨论' />,
            key: 'discussions',
            label: '讨论区',
            value: <Text type='secondary'>GitHub Discussions</Text>,
          },
        ]}
      />

      <InfoSection
        title='法律与帮助'
        rows={[
          {
            action: <InternalAction href='/help' label='查看帮助' />,
            key: 'help',
            label: '帮助与支持',
            value: <Text type='secondary'>部署、渠道连接与反馈入口</Text>,
          },
          {
            action: <InternalAction href='/privacy' label='查看政策' />,
            key: 'privacy',
            label: '隐私政策',
            value: <Text type='secondary'>官方托管实例如何处理信息</Text>,
          },
          {
            action: <InternalAction href='/terms' label='查看条款' />,
            key: 'terms',
            label: '服务条款',
            value: <Text type='secondary'>账户、内容与开源软件责任</Text>,
          },
        ]}
      />

      <Text type='secondary' style={{ fontSize: 12 }}>
        {SITE_NAME} 是开源项目，源码按 MIT License 发布。
      </Text>
    </Flex>
  )
}
