'use client'

import type { ModelAbilities } from '@pure/model-bank'
import { Icon, Tag, Tooltip, Flex } from '@pure/ui'
import { formatTokenNumber } from '@pure/utils/client'
import { createStaticStyles, cssVar } from 'antd-style'
import { AtomIcon, EyeIcon, Globe2, ImageIcon, WrenchIcon } from 'lucide-react'
import { memo } from 'react'

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
  abilities?: ModelAbilities
  contextWindowTokens?: number
}

const ModelFeatureTags = memo<ModelFeatureTagsProps>(({ abilities, contextWindowTokens }) => {
  const showFunctionCall = Boolean(abilities?.functionCall)
  const showImageGeneration = Boolean(abilities?.imageGeneration)
  const showReasoning = Boolean(abilities?.reasoning)
  const showVision = Boolean(abilities?.vision)
  const showWebSearch = Boolean(abilities?.webSearch)
  const showTokens = typeof contextWindowTokens === 'number'

  if (!showFunctionCall && !showImageGeneration && !showReasoning && !showVision && !showWebSearch && !showTokens) {
    return null
  }

  return (
    <Flex className='flex-row gap-0.5 justify-end w-full'>
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
      {/* {showReasoning ? (
        <Tooltip title='该模型支持深度思考'>
          <Tag className={styles.tag} color='purple' size='small'>
            <Icon icon={AtomIcon} size={12} />
          </Tag>
        </Tooltip>
      ) : null} */}
      {showWebSearch ? (
        <Tooltip title='该模型支持联网搜索'>
          <Tag className={styles.tag} color='cyan' size='small'>
            <Icon icon={Globe2} size={12} />
          </Tag>
        </Tooltip>
      ) : null}
      {showImageGeneration ? (
        <Tooltip title='该模型支持图片生成'>
          <Tag className={styles.tag} color='magenta' size='small'>
            <Icon icon={ImageIcon} size={12} />
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
    </Flex>
  )
})

ModelFeatureTags.displayName = 'ModelFeatureTags'

export default ModelFeatureTags
