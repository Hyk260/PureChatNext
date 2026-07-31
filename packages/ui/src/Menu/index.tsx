import { Menu as LobeMenu } from '@lobehub/ui'
import type { MenuProps } from '@lobehub/ui'
import { memo } from 'react'

const Menu = memo<MenuProps>(({ selectable = false, ...rest }) => <LobeMenu selectable={selectable} {...rest} />)

Menu.displayName = 'Menu'

export { Menu, type MenuProps }
