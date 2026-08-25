'use client'

import type { ReactNode } from 'react'

import { SITE_DISCUSSIONS_URL, SITE_ISSUES_URL, SITE_REPOSITORY_URL } from '@/const/site'
import Link from '@/utils/link'

const UPDATED_AT = '2026 年 8 月 19 日'

type Section = {
  content: ReactNode
  title: string
}

type PublicInfoPageProps = {
  description: string
  sections: Section[]
  title: string
}

const ExternalLink = ({ children, href }: { children: ReactNode; href: string }) => (
  <a
    className='text-primary underline decoration-primary/35 underline-offset-4 hover:decoration-primary'
    href={href}
    rel='noreferrer'
    target='_blank'
  >
    {children}
  </a>
)

const PublicInfoPage = ({ description, sections, title }: PublicInfoPageProps) => (
  <div className='h-full overflow-y-auto bg-background text-foreground'>
    <main className='mx-auto flex w-full max-w-3xl flex-col gap-10 px-6 py-12 md:px-10 md:py-16'>
      <header className='flex flex-col gap-4 border-b border-border pb-8'>
        <Link className='w-fit text-sm text-muted-foreground no-underline hover:text-foreground' href='/'>
          ← 返回 PureChat
        </Link>
        <h1 className='m-0 text-3xl font-bold tracking-tight md:text-4xl'>{title}</h1>
        <p className='m-0 text-base leading-7 text-muted-foreground'>{description}</p>
        <p className='m-0 text-sm text-muted-foreground'>最后更新：{UPDATED_AT}</p>
      </header>

      <div className='flex flex-col gap-9'>
        {sections.map((section) => (
          <section className='flex flex-col gap-3' key={section.title}>
            <h2 className='m-0 text-xl font-semibold'>{section.title}</h2>
            <div className='space-y-3 text-[15px] leading-7 text-muted-foreground'>{section.content}</div>
          </section>
        ))}
      </div>

      <footer className='border-t border-border pt-6 text-sm text-muted-foreground'>
        PureChat 是开源项目。第三方自托管实例的运营者可能采用不同规则，请同时查看该实例提供的说明。
      </footer>
    </main>
  </div>
)

const PrivacyContent = () => (
  <PublicInfoPage
    description='本政策说明 PureChat 官方托管实例与开源自托管版本如何处理信息。'
    sections={[
      {
        title: '1. 适用范围',
        content: (
          <p>
            本政策适用于 PureChat 项目维护者运营的公开网站与在线体验。若你使用第三方部署的
            PureChat，数据处理方是该实例的运营者；若你自行部署，则由你控制数据库、对象存储、模型密钥与日志。
          </p>
        ),
      },
      {
        title: '2. 我们处理的信息',
        content: (
          <ul className='list-disc space-y-2 pl-6'>
            <li>账户信息：邮箱、用户名、头像、登录提供方标识及必要的认证记录。</li>
            <li>产品数据：对话、上传文件、Agent 配置、渠道绑定配置及你主动提交的反馈。</li>
            <li>运行数据：请求时间、错误日志、设备与浏览器概况、访问页面和性能指标。</li>
            <li>来源数据：UTM 参数、落地页和来源站点；浏览器仅保存首次与最近一次来源，不记录消息正文。</li>
          </ul>
        ),
      },
      {
        title: '3. 信息用途与第三方服务',
        content: (
          <>
            <p>信息用于提供登录、AI 对话、文件处理、渠道连接、额度核算、安全防护、故障排查和产品改进。</p>
            <p>
              根据实例配置，内容可能被发送给你选择的模型、搜索、邮件、对象存储、数据库或分析服务。使用自备 API Key
              时，请同时阅读对应服务商的隐私政策。
            </p>
          </>
        ),
      },
      {
        title: '4. 保存、安全与删除',
        content: (
          <p>
            我们只在实现上述目的所需期间保留信息，并采用访问控制、加密密钥和最小权限等措施降低风险。互联网服务无法保证绝对安全。账户删除、数据导出或安全问题可通过支持渠道提出。
          </p>
        ),
      },
      {
        title: '5. 联系我们',
        content: (
          <p>
            隐私请求请提交到 <ExternalLink href={SITE_ISSUES_URL}>GitHub Issues</ExternalLink>。涉及敏感安全信息时，请按{' '}
            <ExternalLink href={`${SITE_REPOSITORY_URL}/security/policy`}>安全政策</ExternalLink>
            中的私密渠道报告，不要公开密钥或个人数据。
          </p>
        ),
      },
    ]}
    title='隐私政策'
  />
)

const TermsContent = () => (
  <PublicInfoPage
    description='使用 PureChat 前，请了解账户、内容、第三方模型与开源软件相关责任。'
    sections={[
      {
        title: '1. 接受条款',
        content: <p>访问、注册或使用 PureChat 即表示你同意本条款与隐私政策。若不同意，请停止使用官方托管实例。</p>,
      },
      {
        title: '2. 账户与合规使用',
        content: (
          <ul className='list-disc space-y-2 pl-6'>
            <li>你应保护账户、API Key、渠道凭证和部署环境，并对账户下的活动负责。</li>
            <li>不得利用服务侵害他人权益、绕过额度与安全限制、传播违法内容或干扰系统运行。</li>
            <li>不得将 AI 输出直接视为医疗、法律、财务或其他高风险领域的专业结论。</li>
          </ul>
        ),
      },
      {
        title: '3. 内容、模型与第三方服务',
        content: (
          <p>
            你保留对合法输入内容的权利，并负责确认有权处理上传内容。AI
            输出可能不准确、过时或不完整。模型、搜索、存储、登录和消息渠道由相应第三方提供时，还受其条款约束。
          </p>
        ),
      },
      {
        title: '4. 免费额度与服务变更',
        content: (
          <p>
            免费额度、可用模型和功能可能因成本、安全或供应商规则而调整。我们可对滥用账户采取限流、暂停或终止措施，并会尽力通过
            Release、Discussion 或站内说明公布重要变化。
          </p>
        ),
      },
      {
        title: '5. 开源与免责声明',
        content: (
          <p>
            PureChat 源代码按仓库中的 MIT License
            提供。除法律另有要求外，软件和托管体验按“现状”提供，不承诺持续可用、完全无误或适合特定目的。你应自行备份重要数据并评估部署风险。
          </p>
        ),
      },
      {
        title: '6. 联系与反馈',
        content: (
          <p>
            使用问题与条款反馈可前往 <ExternalLink href={SITE_DISCUSSIONS_URL}>GitHub Discussions</ExternalLink> 或{' '}
            <ExternalLink href={SITE_ISSUES_URL}>GitHub Issues</ExternalLink>。
          </p>
        ),
      },
    ]}
    title='服务条款'
  />
)

const HelpContent = () => (
  <PublicInfoPage
    description='从在线体验、自托管部署到渠道连接，优先从下面的公开入口获得帮助。'
    sections={[
      {
        title: '快速开始',
        content: (
          <ul className='list-disc space-y-2 pl-6'>
            <li>
              <ExternalLink href={`${SITE_REPOSITORY_URL}#快速开始`}>本地开发与快速开始</ExternalLink>
            </li>
            <li>
              <ExternalLink href={`${SITE_REPOSITORY_URL}/blob/main/docs/self-hosting/platform/docker.md`}>
                Docker 自托管
              </ExternalLink>
            </li>
            <li>
              <ExternalLink
                href={`${SITE_REPOSITORY_URL}/blob/main/docs/self-hosting/configuration/environment.md`}
              >
                环境变量与生产配置
              </ExternalLink>
            </li>
            <li>
              <ExternalLink href={`${SITE_REPOSITORY_URL}/tree/main/docs/self-hosting`}>
                微信、QQ、搜索和认证文档
              </ExternalLink>
            </li>
          </ul>
        ),
      },
      {
        title: '获得支持',
        content: (
          <ul className='list-disc space-y-2 pl-6'>
            <li>
              使用咨询和经验交流：<ExternalLink href={SITE_DISCUSSIONS_URL}>GitHub Discussions</ExternalLink>
            </li>
            <li>
              可复现的缺陷：<ExternalLink href={SITE_ISSUES_URL}>GitHub Issues</ExternalLink>
            </li>
            <li>
              安全漏洞：<ExternalLink href={`${SITE_REPOSITORY_URL}/security/policy`}>Security Policy</ExternalLink>
            </li>
          </ul>
        ),
      },
      {
        title: '提交问题前',
        content: (
          <p>
            请先搜索已有 Issue，并提供部署方式、版本、复现步骤、预期结果和已脱敏的日志。不要提交 API
            Key、Cookie、数据库连接串、二维码凭证或包含个人内容的截图。
          </p>
        ),
      },
    ]}
    title='帮助与支持'
  />
)

export const PrivacyPage = PrivacyContent
export const TermsPage = TermsContent
export const HelpPage = HelpContent
