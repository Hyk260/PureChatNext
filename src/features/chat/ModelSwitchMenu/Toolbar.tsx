'use client'

import { Flex } from 'antd'
import { ActionIcon, SearchBar, stopPropagation, Tooltip } from '@pure/ui'
import { createStaticStyles, cssVar, cx } from 'antd-style'
import { Boxes, Brain } from 'lucide-react'
import { memo } from 'react'

import { type GroupMode } from './types'

const styles = createStaticStyles(({ css }) => ({
  modeBtn: css`
    color: ${cssVar.colorTextTertiary};
    border-radius: ${cssVar.borderRadiusSM};

    &:hover {
      color: ${cssVar.colorTextSecondary};
      background: ${cssVar.colorFillTertiary};
    }
  `,
  modeBtnActive: css`
    color: ${cssVar.colorText};
    background: ${cssVar.colorFillSecondary};
  `,
  toolbar: css`
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};
  `,
}))

export interface ToolbarProps {
  groupMode: GroupMode
  keyword: string
  onGroupModeChange: (mode: GroupMode) => void
  onKeywordChange: (keyword: string) => void
}

const Toolbar = memo<ToolbarProps>(({ groupMode, keyword, onGroupModeChange, onKeywordChange }) => (
  <Flex align='center' className={styles.toolbar} gap={4} style={{ paddingBlock: 8, paddingInline: 8 }}>
    <SearchBar
      placeholder='搜索模型...'
      size='small'
      style={{ flex: 1 }}
      value={keyword}
      variant='borderless'
      onInputChange={onKeywordChange}
      onKeyDown={stopPropagation}
    />
    <Flex gap={2} style={{ flexShrink: 0 }}>
      <Tooltip title='按模型'>
        <ActionIcon
          className={cx(styles.modeBtn, groupMode === 'byModel' && styles.modeBtnActive)}
          icon={Brain}
          size='small'
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onGroupModeChange('byModel')
          }}
        />
      </Tooltip>
      <Tooltip title='按供应商'>
        <ActionIcon
          className={cx(styles.modeBtn, groupMode === 'byProvider' && styles.modeBtnActive)}
          icon={Boxes}
          size='small'
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onGroupModeChange('byProvider')
          }}
        />
      </Tooltip>
    </Flex>
  </Flex>
))

Toolbar.displayName = 'ModelSwitchToolbar'

export default Toolbar
