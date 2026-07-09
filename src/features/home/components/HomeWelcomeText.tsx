'use client'

import { Text } from '@lobehub/ui'
import { createStaticStyles, cssVar } from 'antd-style'
import { memo } from 'react'

const styles = createStaticStyles(({ css }) => ({
  text: css`
    min-height: 1.6em;
    padding-inline-start: 5px;
    color: ${cssVar.colorTextSecondary};
    line-height: 1.6;
  `,
}))

const HomeWelcomeText = memo(() => {
  return (
    <Text className={styles.text} fontSize={16}>
      继续前行吧 听候差遣
    </Text>
  )
})

HomeWelcomeText.displayName = 'HomeWelcomeText'

export default HomeWelcomeText
