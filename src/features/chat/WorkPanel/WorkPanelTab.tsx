'use client'

import { Tag } from '@pure/ui'
import { createStaticStyles, cssVar, cx } from '@lobehub/ui'
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

    > button {
      display: inline-flex !important;
      flex: none;
      align-items: center;
      justify-content: center;

      width: 16px;
      height: 16px;
      margin-inline-start: 2px !important;
      padding: 0;
      border: 0;
      border-radius: 3px;
      background: transparent;
      cursor: pointer;

      color: inherit;
      opacity: 0;
      transition:
        background 0.15s ${cssVar.motionEaseInOut},
        opacity 0.15s ${cssVar.motionEaseInOut};

      &:hover {
        background: ${cssVar.colorFillSecondary};
      }
    }

    &:hover {
      color: ${cssVar.colorText} !important;
      background: ${cssVar.colorFillTertiary} !important;

      > button {
        opacity: 1;
      }
    }

    &:focus-within > button {
      opacity: 1;
    }
  `,
  tabActive: css`
    color: ${cssVar.colorText} !important;
    background: ${cssVar.colorFillSecondary} !important;

    > button {
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
      className={cx(styles.tab, 'max-w-56', active && styles.tabActive)}
      size='small'
      variant='borderless'
      onClick={onSelect}
    >
      <span className={styles.tabLabel}>{label}</span>
      <button aria-label={`关闭${label}`} type='button' onClick={handleClose}>
        <X aria-hidden='true' size={12} strokeWidth={2} />
      </button>
    </Tag>
  )
})

WorkPanelTab.displayName = 'WorkPanelTab'

export default WorkPanelTab
