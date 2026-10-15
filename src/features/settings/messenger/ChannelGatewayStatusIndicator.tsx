import { Flex, Text, Tooltip } from '@pure/ui'
import { CheckCircle2, CircleHelp, CircleX, LoaderCircle, TriangleAlert } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type ChannelGatewayStatusType = 'success' | 'warning' | 'error' | 'info' | 'loading'

export type ChannelGatewayStatus = {
  description?: string
  title: string
  type: ChannelGatewayStatusType
}

const STATUS_PRESENTATION: Record<ChannelGatewayStatusType, { color: string; Icon: LucideIcon }> = {
  success: { color: 'text-green', Icon: CheckCircle2 },
  warning: { color: 'text-orange', Icon: TriangleAlert },
  error: { color: 'text-red', Icon: CircleX },
  info: { color: 'text-primary', Icon: CircleHelp },
  loading: { color: 'text-muted-foreground', Icon: LoaderCircle },
}

export function ChannelGatewayStatusIndicator({ description, title, type }: ChannelGatewayStatus) {
  const { color, Icon } = STATUS_PRESENTATION[type]

  return (
    <Tooltip
      title={
        <Flex className='flex-col gap-1'>
          <Text strong>{title}</Text>
          {description ? <Text className='text-xs'>{description}</Text> : null}
        </Flex>
      }
    >
      <span
        aria-label={title}
        className='inline-flex size-5 cursor-help items-center justify-center'
        role='img'
        tabIndex={0}
      >
        <Icon aria-hidden='true' className={color} size={16} />
      </span>
    </Tooltip>
  )
}
