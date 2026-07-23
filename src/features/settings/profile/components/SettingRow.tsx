'use client'

import { Typography } from 'antd'
import { createStaticStyles } from 'antd-style'
import { type ReactNode } from 'react'

interface SettingRowProps {
  action?: ReactNode
  children?: ReactNode
  label?: string
  labelSlot?: ReactNode
}

const styles = createStaticStyles(({ css, responsive }) => ({
  action: css`
    flex-shrink: 0;
    margin-inline-start: auto;
  `,
  body: css`
    display: flex;
    flex: 1;
    gap: 12px;
    align-items: center;
    justify-content: space-between;
    min-width: 0;
    min-height: 32px;
  `,
  label: css`
    flex: 0 0 160px;
    padding-block: 4px;

    ${responsive.md} {
      flex: 0 0 auto;
      padding-block: 0;
    }
  `,
  row: css`
    display: flex;
    gap: 24px;
    align-items: flex-start;
    min-height: 48px;
    padding-block: 16px;

    ${responsive.md} {
      flex-direction: column;
      gap: 12px;
      align-items: stretch;
    }
  `,
}))

export function SettingRow({ action, children, label, labelSlot }: SettingRowProps) {
  return (
    <div className={styles.row}>
      <div className={styles.label}>
        {labelSlot ?? (label ? <Typography.Text strong>{label}</Typography.Text> : null)}
      </div>
      <div className={styles.body}>
        {children}
        {action ? <div className={styles.action}>{action}</div> : null}
      </div>
    </div>
  )
}
