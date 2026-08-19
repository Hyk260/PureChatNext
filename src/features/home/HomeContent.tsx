'use client'

import { memo } from 'react'

import { Flexbox } from '@pure/ui'
import { createStaticStyles, cssVar } from 'antd-style'
import HomeChatInput from '@/features/home/components/HomeChatInput'

const styles = createStaticStyles(({ css }) => ({
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
    <Flexbox className={'w-full'} gap={28}>
      <h1 className={styles.title}>今天想聊点什么？</h1>
      <HomeChatInput />
    </Flexbox>
  )
})

HomeContent.displayName = 'HomeContent'

export default HomeContent
