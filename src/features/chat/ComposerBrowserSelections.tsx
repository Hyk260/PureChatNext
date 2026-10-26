import { ActionIcon, Text } from '@lobehub/ui'
import { SquareDashedMousePointer, X } from 'lucide-react'
import { memo } from 'react'

import type { BrowserContextSelection } from '@/features/chat/browserContext'

const ComposerBrowserSelections = memo<{
  selections: BrowserContextSelection[]
  onRemove: (id: string) => void
}>(({ selections, onRemove }) => (
  <div aria-label='网页元素上下文' className='mb-3 flex flex-col gap-2'>
    {selections.map((selection) => (
      <div className='flex items-start gap-2 rounded-lg border border-app-border-secondary p-2' key={selection.id}>
        <SquareDashedMousePointer aria-hidden className='mt-1 shrink-0' size={16} />
        <div className='min-w-0 flex-1'>
          <Text as='div' ellipsis title={selection.selector}>
            {selection.selector || `<${selection.tag}>`}
          </Text>
          <Text as='div' ellipsis fontSize={12} title={selection.url} type='secondary'>
            {selection.pageTitle || selection.url}
          </Text>
          <Text as='div' ellipsis fontSize={12}>
            {selection.text.slice(0, 120) || selection.html.slice(0, 120)}
          </Text>
        </div>
        <ActionIcon
          aria-label='移除网页元素'
          icon={X}
          size='small'
          title='移除网页元素'
          onClick={() => onRemove(selection.id)}
        />
      </div>
    ))}
  </div>
))

ComposerBrowserSelections.displayName = 'ComposerBrowserSelections'
export default ComposerBrowserSelections
