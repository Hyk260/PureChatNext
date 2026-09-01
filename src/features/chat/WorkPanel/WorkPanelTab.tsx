'use client'

import { Tag } from '@pure/ui'
import { createStaticStyles, cssVar, cx } from 'antd-style'
import { X } from 'lucide-react'
import { memo, useCallback } from 'react'

// 固定边框与关闭图标占位，避免切换 active 时 Tab 宽度跳动
const styles = createStaticStyles(({ css }) => ({
  tab: css`
    cursor: pointer;

    display: inline-flex !important;
    flex: none;
    align-items: center;

    height: 28px !important;
    margin: 0 !important;
    padding-inline: 10px 6px !important;
    border: 1px solid transparent !important;
    border-radius: 6px !important;

    color: ${cssVar.colorTextSecondary} !important;
    font-size: 13px;
    line-height: 1;
    background: transparent !important;

    transition:
      background 0.15s ${cssVar.motionEaseInOut},
      color 0.15s ${cssVar.motionEaseInOut};

    .ant-tag-close-icon {
      display: inline-flex !important;
      flex: none;
      align-items: center;
      justify-content: center;

      width: 14px;
      height: 14px;
      margin-inline-start: 2px !important;

      color: inherit;
      opacity: 0;
      transition: opacity 0.15s ${cssVar.motionEaseInOut};
    }

    &:hover {
      color: ${cssVar.colorText} !important;
      background: ${cssVar.colorFillTertiary} !important;

      .ant-tag-close-icon {
        opacity: 1;
      }
    }
  `,
  tabActive: css`
    color: ${cssVar.colorText} !important;
    background: ${cssVar.colorFillSecondary} !important;

    .ant-tag-close-icon {
      opacity: 1;
    }
  `,
  tabLabel: css`
    overflow: hidden;
    min-width: 0;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
}))

type Props = {
  active: boolean
  label: string
  onClose: () => void
  onSelect: () => void
}

const WorkPanelTab = memo<Props>(({ active, label, onClose, onSelect }) => {
  const handleClose = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      event.preventDefault()
      event.stopPropagation()
      onClose()
    },
    [onClose]
  )

  return (
    <Tag
      className={cx(styles.tab, active && styles.tabActive)}
      closable
      closeIcon={<X aria-label={`关闭${label}`} size={12} strokeWidth={2} />}
      size='small'
      variant='borderless'
      onClick={onSelect}
      onClose={handleClose}
    >
      <span className={styles.tabLabel}>{label}</span>
    </Tag>
  )
})

WorkPanelTab.displayName = 'WorkPanelTab'

export default WorkPanelTab
