'use client'

import { type BlockProps, type IconProps, Block, Center, Flexbox, Icon, Text } from '@lobehub/ui'
import { createStaticStyles, cssVar } from 'antd-style'
import { memo, type ReactNode } from 'react'

const styles = createStaticStyles(({ css }) => ({
  container: css`
    user-select: none;
    overflow: hidden;
    min-width: 32px;
  `,
}))

export interface NavItemProps extends Omit<BlockProps, 'children' | 'title'> {
  active?: boolean
  icon?: IconProps['icon']
  iconSize?: number
  onItemClick?: () => void
  title: ReactNode
}

const NavItem = memo<NavItemProps>(
  ({ active, className, clickable, icon, iconSize = 18, onItemClick, title, ...rest }) => {
    const iconColor = active ? cssVar.colorText : cssVar.colorTextDescription
    const textColor = active ? cssVar.colorText : cssVar.colorTextSecondary
    const variant = active ? 'filled' : 'borderless'

    return (
      <Block
        horizontal
        align='center'
        className={[styles.container, className].filter(Boolean).join(' ')}
        clickable={clickable ?? Boolean(onItemClick)}
        gap={8}
        height={36}
        paddingInline={4}
        variant={variant}
        onClick={onItemClick}
        {...rest}
      >
        {icon ? (
          <Center flex='none' height={28} width={28}>
            <Icon color={iconColor} icon={icon} size={iconSize} />
          </Center>
        ) : null}
        <Flexbox flex={1} style={{ overflow: 'hidden' }}>
          <Text
            color={textColor}
            ellipsis
            style={{ flex: 1, minWidth: 0 }}
            title={typeof title === 'string' ? title : undefined}
          >
            {title}
          </Text>
        </Flexbox>
      </Block>
    )
  },
)

NavItem.displayName = 'NavItem'

export default NavItem
