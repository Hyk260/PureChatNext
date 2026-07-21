'use client'

import { ModelIcon } from '@lobehub/icons'
import { Center } from '@lobehub/ui'
import { createStaticStyles, cssVar } from 'antd-style'
import { memo } from 'react'

import ModelSwitchMenu, { useCurrentHomeModel } from '@/features/chat/ModelSwitchMenu'

const styles = createStaticStyles(({ css }) => ({
  icon: css`
    transition: scale 400ms cubic-bezier(0.215, 0.61, 0.355, 1);
  `,
  /** Aligns with lobe ChatInput `Model` trigger */
  model: css`
    cursor: pointer;
    border-radius: 24px;

    &:hover {
      background: ${cssVar.colorFillSecondary};
    }

    &:active div {
      scale: 0.8;
    }
  `,
}))

/**
 * Icon model switcher — mirrors lobe agent chat `leftActions: ['model']`.
 */
const ModelSelector = memo(() => {
  const current = useCurrentHomeModel()

  return (
    <ModelSwitchMenu openOnHover>
      <Center className={styles.model} height={32} width={32}>
        <div className={styles.icon}>
          <ModelIcon model={current.model} size={20} />
        </div>
      </Center>
    </ModelSwitchMenu>
  )
})

ModelSelector.displayName = 'ModelSelector'

export default ModelSelector
