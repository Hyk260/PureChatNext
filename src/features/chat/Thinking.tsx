'use client'

import {
  AccordionRoot,
  AccordionHeader,
  AccordionItem,
  AccordionPanel,
  AccordionTrigger,
  Block,
  Icon,
  Flex,
} from '@pure/ui'
import { createStaticStyles, cssVar, cx } from '@lobehub/ui'
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
  // 保留 createStaticStyles：依赖尚无对应 Tailwind 语义 token 的主题或运行时变量。
  thinkingLabel: css`
    color: ${cssVar.colorTextSecondary};
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
    <AccordionRoot
      multiple
      value={open ? ['thinking'] : []}
      style={{ gap: 8 }}
      indicatorPlacement='end'
      variant='filled'
      onValueChange={(keys) => setOpen(keys.length > 0)}
    >
      <AccordionItem value='thinking'>
        <AccordionHeader style={{ paddingBlock: 4, paddingInline: 4, maxWidth: '100%', width: 'fit-content' }}>
          <AccordionTrigger>
            <Flex className='items-center gap-1.5'>
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
              <span className={cx(styles.thinkingLabel, 'text-xs select-none')}>{label}</span>
            </Flex>
          </AccordionTrigger>
        </AccordionHeader>
        <AccordionPanel>
          <MessageMarkdown className={styles.thinkingBody} isStreaming={thinking} text={text} />
        </AccordionPanel>
      </AccordionItem>
    </AccordionRoot>
  )
})

Thinking.displayName = 'Thinking'

export default Thinking
