import { Input, Text, cx } from '@lobehub/ui'
import { History } from 'lucide-react'
import { memo, useId, useState } from 'react'

import { EMPTY_BROWSER_HISTORY, filterBrowserHistory, useBrowserHistoryStore } from './history'

interface Props {
  value: string
  historyScope: string
  disabled: boolean
  onChange: (value: string) => void
  onEditingChange: (editing: boolean) => void
  onNavigate: (value: string) => void
}

const BrowserAddressBar = memo<Props>(({ value, historyScope, disabled, onChange, onEditingChange, onNavigate }) => {
  const history = useBrowserHistoryStore((state) => state.byScope[historyScope] ?? EMPTY_BROWSER_HISTORY)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(-1)
  const listId = useId()
  const matches = filterBrowserHistory(history, query)
  const expanded = open && matches.length > 0
  const active = expanded ? matches[activeIndex] : undefined

  const navigate = (url: string) => {
    setOpen(false)
    setActiveIndex(-1)
    onEditingChange(false)
    onNavigate(url)
  }

  return (
    <form
      className='min-w-24 flex-1'
      onSubmit={(event) => {
        event.preventDefault()
        if (!disabled) navigate(active?.url ?? value)
      }}
    >
      <Input
        aria-activedescendant={active ? `${listId}-${activeIndex}` : undefined}
        aria-autocomplete='list'
        aria-controls={expanded ? listId : undefined}
        aria-expanded={expanded}
        aria-label='浏览器地址'
        autoComplete='off'
        disabled={disabled}
        placeholder='输入网址或搜索'
        role='combobox'
        size='small'
        value={value}
        onBlur={() => {
          setOpen(false)
          onEditingChange(false)
        }}
        onFocus={(event) => {
          setQuery('')
          setActiveIndex(-1)
          setOpen(true)
          onEditingChange(true)
          event.target.select()
        }}
        onClick={() => setOpen(true)}
        onChange={(event) => {
          const next = event.target.value
          onEditingChange(true)
          onChange(next)
          setQuery(next)
          setActiveIndex(-1)
          setOpen(true)
        }}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) {
            if (event.key === 'Enter') event.preventDefault()
            return
          }
          if (event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
            setOpen(false)
            setActiveIndex(-1)
          } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            event.stopPropagation()
            setOpen(true)
            const direction = event.key === 'ArrowDown' ? 1 : -1
            setActiveIndex((index) => {
              if (!matches.length) return -1
              if (index < 0) return direction > 0 ? 0 : matches.length - 1
              return (index + direction + matches.length) % matches.length
            })
          }
        }}
      />
      {expanded ? (
        <div
          aria-label='浏览历史'
          className='absolute inset-x-2 top-full z-50 mt-1 max-h-72 overflow-y-auto rounded-lg bg-background p-1 shadow-lg'
          id={listId}
          role='listbox'
        >
          {matches.map((item, index) => (
            <div
              aria-selected={index === activeIndex}
              className={cx(
                'flex cursor-pointer items-center gap-3 rounded-md p-2 hover:bg-secondary',
                index === activeIndex && 'bg-secondary'
              )}
              id={`${listId}-${index}`}
              key={item.url}
              role='option'
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => navigate(item.url)}
            >
              <History aria-hidden className='shrink-0' size={16} />
              <div className='min-w-0 flex-1'>
                <Text as='div' ellipsis title={item.title}>
                  {item.title}
                </Text>
                <Text as='div' ellipsis fontSize={12} title={item.url} type='secondary'>
                  {item.url}
                </Text>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </form>
  )
})

BrowserAddressBar.displayName = 'BrowserAddressBar'
export default BrowserAddressBar
