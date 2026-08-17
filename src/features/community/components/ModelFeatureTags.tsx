'use client'

import { Icon, Tag, Tooltip, Flexbox } from '@pure/ui'
import { formatTokenNumber } from '@pure/utils/client'
import { createStaticStyles, cssVar } from 'antd-style'
import { EyeIcon, WrenchIcon } from 'lucide-react'
import { memo } from 'react'

import type { DiscoverModelAbilities } from '@/features/community/types'

const styles = createStaticStyles(({ css }) => ({
  tag: css`
    cursor: default;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px !important;
    height: 20px;
    padding: 0 !important;
    border-radius: 4px;
  `,
  token: css`
    cursor: default;
    height: 20px;
    margin: 0;
    padding-inline: 4px;
    border-radius: 4px;
    font-size: 11px;
    line-height: 18px;
    color: ${cssVar.colorTextSecondary};
    background: ${cssVar.colorFillTertiary};
  `,
}))

export interface ModelFeatureTagsProps {
  abilities?: DiscoverModelAbilities
  contextWindowTokens?: number
}

const ModelFeatureTags = memo<ModelFeatureTagsProps>(({ abilities, contextWindowTokens }) => {
  const showFunctionCall = Boolean(abilities?.functionCall)
  const showVision = Boolean(abilities?.vision)
  const showTokens = typeof contextWindowTokens === 'number'

  if (!showFunctionCall && !showVision && !showTokens) return null

  return (
    <Flexbox horizontal gap={2} justify='flex-end' style={{ width: '100%' }}>
      {showFunctionCall ? (
        <Tooltip title='该模型支持工具调用（Tool Calling）'>
          <Tag className={styles.tag} color='blue' size='small'>
            <Icon icon={WrenchIcon} size={12} />
          </Tag>
        </Tooltip>
      ) : null}
      {showVision ? (
        <Tooltip title='该模型支持视觉识别'>
          <Tag className={styles.tag} color='geekblue' size='small'>
            <Icon icon={EyeIcon} size={12} />
          </Tag>
        </Tooltip>
      ) : null}
      {showTokens ? (
        <Tooltip title={`该模型单个会话最多支持 ${contextWindowTokens!.toLocaleString('en-US')} Tokens`}>
          <Tag className={styles.token} size='small'>
            {formatTokenNumber(contextWindowTokens)}
          </Tag>
        </Tooltip>
      ) : null}
    </Flexbox>
  )
})

ModelFeatureTags.displayName = 'ModelFeatureTags'

export default ModelFeatureTags
