'use client'

import { memo } from 'react'

import { Flex } from '@pure/ui'
import { createStaticStyles, cssVar } from 'antd-style'
import HomeChatInput from '@/features/home/components/HomeChatInput'

const styles = createStaticStyles(({ css }) => ({
  description: css`
    margin: 0;
    color: ${cssVar.colorTextSecondary};
    font-size: clamp(14px, 1.6vw, 17px);
    line-height: 1.7;
    text-align: center;
  `,
  title: css`
    margin: 0;
    color: ${cssVar.colorText};
    font-size: clamp(28px, 3vw, 40px);
    font-weight: 700;
    letter-spacing: -0.04em;
    text-align: center;

    @container (max-width: 360px) {
      display: none;
    }
  `,
}))

const HomeContent = memo(() => {
  return (
    <Flex className='w-full flex-col gap-6'>
      <Flex className='flex-col items-center gap-2.5'>
        <h1 className={styles.title}>把你的 AI 助手接入微信和 QQ</h1>
        <p className={styles.description}>自托管、多模型、联网搜索、文件处理，数据和密钥由你掌控。</p>
      </Flex>
      <HomeChatInput />
    </Flex>
  )
})

HomeContent.displayName = 'HomeContent'

export default HomeContent
