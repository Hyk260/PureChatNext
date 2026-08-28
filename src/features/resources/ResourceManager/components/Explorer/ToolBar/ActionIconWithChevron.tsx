'use client'

import { Button, Icon, Flex } from '@pure/ui'
import { cssVar } from 'antd-style'
import { ChevronDownIcon } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { memo } from 'react'
import type { ComponentProps } from 'react'

interface ActionIconWithChevronProps extends Omit<ComponentProps<typeof Button>, 'icon'> {
  icon: LucideIcon
}

const ActionIconWithChevron = memo<ActionIconWithChevronProps>(
  ({ icon, title, style, disabled, className, ...rest }) => {
    return (
      <Button
        {...rest}
        className={className}
        disabled={disabled}
        style={{ paddingInline: 4, ...style }}
        title={title}
        type='text'
      >
        <Flex className='flex-row items-center gap-1'>
          <Icon color={cssVar.colorIcon} icon={icon} size={18} />
          <Icon color={cssVar.colorIcon} icon={ChevronDownIcon} size={14} />
        </Flex>
      </Button>
    )
  }
)

ActionIconWithChevron.displayName = 'ActionIconWithChevron'

export default ActionIconWithChevron
