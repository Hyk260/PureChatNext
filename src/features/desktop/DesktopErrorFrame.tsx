import { Flex } from '@pure/ui'
import type { PropsWithChildren } from 'react'

import InsetContentFrame from '@/layout/InsetContentFrame'

const DesktopErrorFrame = ({ children }: PropsWithChildren) => (
  <InsetContentFrame sidebarCollapsed>
    <Flex className='h-full min-h-0 w-full flex-col overflow-y-auto'>{children}</Flex>
  </InsetContentFrame>
)

export default DesktopErrorFrame
