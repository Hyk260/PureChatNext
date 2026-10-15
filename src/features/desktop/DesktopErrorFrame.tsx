import { Flex } from '@pure/ui'
import type { PropsWithChildren } from 'react'

import InsetContentFrame from '@/layout/InsetContentFrame'

const DesktopErrorFrame = ({ children }: PropsWithChildren) => (
  <InsetContentFrame sidebarCollapsed>
    <Flex className='size-full min-h-0 flex-col overflow-y-auto'>{children}</Flex>
  </InsetContentFrame>
)

export default DesktopErrorFrame
