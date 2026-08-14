'use client'

import { Accordion, AccordionItem, Block, Icon, Flexbox } from '@pure/ui'
import { createStaticStyles, cssVar } from 'antd-style'
import { AtomIcon, Loader2Icon } from 'lucide-react'
import { memo, useEffect, useState } from 'react'

import MessageMarkdown from '@/features/chat/MessageMarkdown'

const styles = createStaticStyles(({ css }) => ({
  thinkingBody: css`
    overflow-y: auto;
    max-height: min(40vh, 320px);
    padding: 0 8px 8px;

    color: ${cssVar.colorTextDescription};
    font-size: 13px;
    line-height: 1.55;
    word-break: break-word;

    article * {
      color: ${cssVar.colorTextDescription};
    }
  `,
  thinkingLabel: css`
    color: ${cssVar.colorTextSecondary};
    font-size: 12px;
    user-select: none;
  `,
}))

interface ThinkingProps {
  duration?: number
  thinking?: boolean
  text: string
}

function getThinkingLabel(thinking: boolean, duration?: number) {
  if (thinking) return '深度思考中…'
  if (duration !== undefined) return `已深度思考（用时 ${(duration / 1000).toFixed(1)} 秒）`
  return '已深度思考'
}

const Thinking = memo<ThinkingProps>(({ text, thinking = false, duration }) => {
  const [open, setOpen] = useState(thinking)

  useEffect(() => {
    setOpen(thinking)
  }, [thinking])

  const label = getThinkingLabel(thinking, duration)

  return (
    <Accordion
      expandedKeys={open ? ['thinking'] : []}
      gap={8}
      indicatorPlacement='end'
      variant='filled'
      onExpandedChange={(keys) => setOpen(keys.length > 0)}
    >
      <AccordionItem
        itemKey='thinking'
        paddingBlock={4}
        paddingInline={4}
        styles={{ header: { maxWidth: '100%', width: 'fit-content' } }}
        title={
          <Flexbox horizontal align='center' gap={6}>
            <Block
              align='center'
              flex='none'
              gap={4}
              height={24}
              horizontal
              justify='center'
              style={{ fontSize: 12 }}
              variant='filled'
              width={24}
            >
              <Icon
                color={thinking ? cssVar.colorTextDescription : cssVar.purple}
                icon={thinking ? Loader2Icon : AtomIcon}
                size={14}
                spin={thinking}
              />
            </Block>
            <span className={styles.thinkingLabel}>{label}</span>
          </Flexbox>
        }
      >
        <MessageMarkdown className={styles.thinkingBody} isStreaming={thinking} text={text} />
      </AccordionItem>
    </Accordion>
  )
})

Thinking.displayName = 'Thinking'

export default Thinking
