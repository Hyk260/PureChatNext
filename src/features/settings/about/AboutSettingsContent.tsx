'use client'

import { ActionIcon, Block, Button, copyToClipboard, Flexbox, Github, PureChatMark, Tag, Text } from '@pure/ui'
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
    <a href={href} rel='noreferrer' target='_blank' style={{ color: 'inherit', textDecoration: 'none' }}>
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
    <Link href={href} style={{ color: 'inherit', textDecoration: 'none' }}>
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
      <Flexbox style={{ paddingInline: 16 }}>
        {rows.map((row, index) => (
          <Fragment key={row.key}>
            {index > 0 ? <Divider style={{ margin: 0 }} /> : null}
            <SettingRow action={row.action} label={row.label}>
              {row.value}
            </SettingRow>
          </Fragment>
        ))}
      </Flexbox>
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
    <Flexbox gap={24} style={{ paddingBlock: '24px 64px', paddingInline: 24, width: '100%' }}>
      <Block padding={16} variant='filled'>
        <Flexbox horizontal align='center' gap={16} justify='space-between' wrap='wrap'>
          <Flexbox horizontal align='center' className={styles.brand} gap={12}>
            <div className={styles.mark}>
              <PureChatMark size={28} />
            </div>
            <Flexbox gap={4} style={{ minWidth: 0 }}>
              <Flexbox horizontal align='center' gap={8}>
                <Text className={styles.name}>{SITE_NAME}</Text>
                <Tag size='small'>{VERSION_LABEL}</Tag>
              </Flexbox>
              <Text className={styles.description} type='secondary'>
                {SITE_DESCRIPTION}
              </Text>
            </Flexbox>
          </Flexbox>
          <Button
            icon={<Github size={16} />}
            onClick={() => window.open(SITE_REPOSITORY_URL, '_blank', 'noopener,noreferrer')}
          >
            GitHub
          </Button>
        </Flexbox>
      </Block>

      <InfoSection
        title='应用信息'
        rows={[
          {
            action: (
              <ActionIcon icon={Copy} size='small' title='复制版本号' onClick={() => void handleCopyVersion()} />
            ),
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
                <Flexbox horizontal align='center' gap={8}>
                  <Github size={16} />
                  <Text>{SITE_REPOSITORY_SLUG}</Text>
                </Flexbox>
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
    </Flexbox>
  )
}
