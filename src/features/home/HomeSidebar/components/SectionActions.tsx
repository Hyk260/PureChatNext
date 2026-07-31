'use client'

import { DropdownMenu, Icon, Flexbox } from '@pure/ui'
import type { MenuProps } from '@pure/ui'
import { createStaticStyles, cssVar } from 'antd-style'
import { MoreHorizontalIcon, PlusIcon } from 'lucide-react'
import { memo } from 'react'

const styles = createStaticStyles(({ css }) => ({
  srOnly: css`
    position: absolute;

    overflow: hidden;
    clip: rect(0, 0, 0, 0);

    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    border: 0;

    white-space: nowrap;
  `,
  trigger: css`
    cursor: pointer;

    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;

    width: 24px;
    height: 24px;
    padding: 0;
    border: none;
    border-radius: 4px;

    color: ${cssVar.colorTextSecondary};
    background: transparent;
    outline: none;

    &:hover {
      color: ${cssVar.colorText};
      background: ${cssVar.colorFillSecondary};
    }
  `,
}))

interface SectionActionsProps {
  addMenuItems?: MenuProps['items']
  menuItems: MenuProps['items']
}

const SectionActions = memo<SectionActionsProps>(({ addMenuItems, menuItems }) => {
  return (
    <Flexbox
      horizontal
      gap={2}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <DropdownMenu items={menuItems} nativeButton triggerProps={{ className: styles.trigger, title: '更多' }}>
        <Icon icon={MoreHorizontalIcon} size='small' />
        <span className={styles.srOnly}>更多</span>
      </DropdownMenu>
      {addMenuItems ? (
        <DropdownMenu items={addMenuItems} nativeButton triggerProps={{ className: styles.trigger, title: '添加' }}>
          <Icon icon={PlusIcon} size='small' />
          <span className={styles.srOnly}>添加</span>
        </DropdownMenu>
      ) : null}
    </Flexbox>
  )
})

SectionActions.displayName = 'SectionActions'

export default SectionActions
