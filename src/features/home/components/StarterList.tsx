'use client'

import { Button, ModelIcon, Flexbox } from '@pure/ui'
import { createStaticStyles, cssVar } from 'antd-style'
import { memo } from 'react'

import { STARTER_MODELS } from '@/const/home/starterModels'
import { useHomeStore } from '@/features/home/store/useHomeStore'

const styles = createStaticStyles(({ css }) => ({
  button: css`
    height: 40px;
    border-color: ${cssVar.colorFillSecondary};
    background: transparent;
    box-shadow: none !important;

    &:hover {
      border-color: ${cssVar.colorFillSecondary} !important;
      background: ${cssVar.colorBgElevated} !important;
    }
  `,
  container: css`
    flex-wrap: wrap;
  `,
}))

const StarterList = memo(() => {
  const setSelectedModel = useHomeStore((s) => s.setSelectedModel)

  return (
    <Flexbox horizontal className={styles.container} gap={8}>
      {STARTER_MODELS.map((item) => (
        <Button
          key={`${item.provider}:${item.model}`}
          className={styles.button}
          icon={<ModelIcon model={item.model} size={16} type='mono' />}
          onClick={() => setSelectedModel(item.provider, item.model)}
        >
          {item.label}
        </Button>
      ))}
    </Flexbox>
  )
})

StarterList.displayName = 'StarterList'

export default StarterList
