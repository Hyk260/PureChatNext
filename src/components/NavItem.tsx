'use client'

import { Block, Center, Icon, Text, Flex } from '@pure/ui'
import type { BlockProps, IconProps } from '@pure/ui'
import { createStaticStyles, cssVar, cx } from 'antd-style'
import { memo } from 'react'
import type { ReactNode } from 'react'

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
        className={cx(styles.container, className)}
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
        <Flex className='flex-col flex-1 overflow-hidden'>
          <Text
            ellipsis
            title={typeof title === 'string' ? title : undefined}
            style={{ color: textColor, flex: 1, minWidth: 0 }}
          >
            {title}
          </Text>
        </Flex>
      </Block>
    )
  }
)

NavItem.displayName = 'NavItem'

export default NavItem
