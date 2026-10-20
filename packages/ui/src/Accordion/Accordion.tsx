'use client'

import {
  AccordionHeader as LobeAccordionHeader,
  AccordionPanel as LobeAccordionPanel,
  AccordionRoot as LobeAccordionRoot,
  AccordionTrigger as LobeAccordionTrigger,
  createStaticStyles,
  cssVar,
  cx,
  useAccordionContext,
} from '@lobehub/ui'
import type { AccordionHeaderProps, AccordionPanelProps, AccordionRootProps, AccordionTriggerProps } from '@lobehub/ui'

// Keep the application spacing and indicator across the v6 primitive/state selectors.
const styles = createStaticStyles(({ css }) => ({
  trigger: css`
    gap: 2px;
    padding: 0;

    &[data-panel-open] > .pure-accordion-indicator {
      transform: rotate(90deg);
    }
  `,
  triggerEnd: css`
    gap: 4px;
  `,
  indicator: css`
    flex: none;
    color: ${cssVar.colorTextDescription};
    transition: transform 200ms ${cssVar.motionEaseOut};

    @media (prefers-reduced-motion: reduce) {
      transition: none;
    }
  `,
  indicatorEnd: css`
    margin-inline-start: auto;
  `,
}))

export function AccordionRoot({ indicatorPlacement = 'inline', ...props }: AccordionRootProps) {
  return <LobeAccordionRoot {...props} indicatorPlacement={indicatorPlacement} />
}

export function AccordionHeader({ className, ...props }: AccordionHeaderProps) {
  return <LobeAccordionHeader {...props} className={cx('mx-0 min-w-0 gap-1 overflow-hidden', className)} />
}

export function AccordionTrigger({
  children,
  className,
  hideIndicator,
  indicatorPlacement,
  ...props
}: AccordionTriggerProps) {
  const context = useAccordionContext()
  const placement = indicatorPlacement ?? context.indicatorPlacement
  const hidden = hideIndicator ?? context.hideIndicator
  const indicator = !hidden && (
    <svg
      aria-hidden='true'
      className={cx('pure-accordion-indicator', styles.indicator, placement === 'end' && styles.indicatorEnd)}
      fill='currentColor'
      height={18}
      viewBox='0 0 16 16'
      width={18}
    >
      <path d='M7.002 10.624a.5.5 0 01-.752-.432V5.808a.5.5 0 01.752-.432l3.758 2.192a.5.5 0 010 .864l-3.758 2.192z' />
    </svg>
  )

  return (
    <LobeAccordionTrigger
      {...props}
      className={cx(styles.trigger, placement === 'end' && styles.triggerEnd, className)}
      hideIndicator
    >
      {placement === 'start' && indicator}
      {children}
      {placement !== 'start' && indicator}
    </LobeAccordionTrigger>
  )
}

export function AccordionPanel({ contentClassName, ...props }: AccordionPanelProps) {
  return <LobeAccordionPanel {...props} contentClassName={cx('p-0', contentClassName)} />
}
