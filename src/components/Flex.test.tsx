import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Flex } from '../../packages/ui/src/Flex'

describe('Flex', () => {
  it('renders a Tailwind flex div and forwards HTML props and ref', () => {
    const ref = { current: null as HTMLDivElement | null }
    const { getByTestId } = render(
      <Flex ref={ref} className={['flex-col', false, ['items-center', undefined], 'gap-2']} data-testid='flex'>
        content
      </Flex>
    )

    const element = getByTestId('flex')
    expect(element.classList.contains('flex')).toBe(true)
    expect(element.classList.contains('flex-col')).toBe(true)
    expect(element.classList.contains('gap-2')).toBe(true)
    expect(element.textContent).toBe('content')
    expect(ref.current).toBe(element)
  })
})
