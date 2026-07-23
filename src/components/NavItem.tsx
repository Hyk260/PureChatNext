'use client'

import { Flex, Typography } from 'antd'
import { Center } from '@pure/ui'
import { type BlockProps, Block, Icon, type IconProps } from '@pure/ui'
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
        <Flex vertical flex={1} style={{ overflow: 'hidden' }}>
          <Typography.Text
            ellipsis
            title={typeof title === 'string' ? title : undefined}
            style={{ color: textColor, flex: 1, minWidth: 0 }}
          >
            {title}
          </Typography.Text>
        </Flex>
      </Block>
    )
  }
)

NavItem.displayName = 'NavItem'

export default NavItem
