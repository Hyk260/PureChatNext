'use client'

import { Flex, Button } from 'antd'
import { Icon } from '@pure/ui'
import { cssVar } from 'antd-style'
import { type LucideIcon, ChevronDownIcon } from 'lucide-react'
import { type ComponentProps, memo } from 'react'

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
        <Flex align='center' gap={4}>
          <Icon color={cssVar.colorIcon} icon={icon} size={18} />
          <Icon color={cssVar.colorIcon} icon={ChevronDownIcon} size={14} />
        </Flex>
      </Button>
    )
  },
)

ActionIconWithChevron.displayName = 'ActionIconWithChevron'

export default ActionIconWithChevron
