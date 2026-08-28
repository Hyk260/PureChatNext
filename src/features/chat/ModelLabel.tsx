'use client'

import { Center, Flex } from '@pure/ui'
import { createStaticStyles, cssVar } from 'antd-style'
import { ChevronDownIcon } from 'lucide-react'
import { memo } from 'react'

import ModelSwitchMenu, { useCurrentHomeModel } from '@/features/chat/ModelSwitchMenu'

const styles = createStaticStyles(({ css }) => ({
  chevron: css`
    color: ${cssVar.colorTextQuaternary};
  `,
  name: css`
    overflow: hidden;

    max-width: 160px;

    font-size: 12px;
    color: ${cssVar.colorTextSecondary};
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  trigger: css`
    cursor: pointer;
    border-radius: 6px;

    &:hover {
      background: ${cssVar.colorFillTertiary};
    }
  `,
}))

/**
 * Text model switcher used in SendArea.
 */
const ModelLabel = memo(() => {
  const current = useCurrentHomeModel()

  return (
    <ModelSwitchMenu openOnHover={false}>
      <Center horizontal className={styles.trigger} height={28} paddingInline={6}>
        <Flex className='flex-row items-center gap-0.5'>
          <span className={styles.name}>{current.displayName}</span>
          <ChevronDownIcon className={styles.chevron} size={12} />
        </Flex>
      </Center>
    </ModelSwitchMenu>
  )
})

ModelLabel.displayName = 'ModelLabel'

export default ModelLabel
