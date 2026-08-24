import { track } from '@vercel/analytics'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { captureAcquisitionAttribution, markFirstConversion, trackAcquisitionEvent } from '@/libs/analytics/acquisition'

vi.mock('@vercel/analytics', () => ({ track: vi.fn() }))

const locationFor = (href: string) => ({ href }) as Location

describe('acquisition analytics', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.mocked(track).mockClear()
  })

  it('keeps first attribution and updates last attribution', () => {
    captureAcquisitionAttribution(
      locationFor('https://next.purechat.cn/?utm_source=github&utm_medium=repo&utm_campaign=legacy'),
      'https://github.com/Hyk260/PureChat'
    )
    captureAcquisitionAttribution(
      locationFor('https://next.purechat.cn/?utm_source=v2ex&utm_medium=community&utm_campaign=launch'),
      'https://www.v2ex.com/'
    )

    trackAcquisitionEvent('chat_intent')

    expect(track).toHaveBeenCalledWith(
      'chat_intent',
      expect.objectContaining({
        first_source: 'github',
        last_campaign: 'launch',
        last_medium: 'community',
        last_source: 'v2ex',
      })
    )
  })

  it('marks a conversion only once per browser', () => {
    expect(markFirstConversion('chat_response')).toBe(true)
    expect(markFirstConversion('chat_response')).toBe(false)
  })

  it('ignores persisted values that do not match the attribution shape', () => {
    localStorage.setItem('purechat:acquisition:first:v1', JSON.stringify({ campaign: 'launch', source: 'github' }))

    trackAcquisitionEvent('chat_intent')

    expect(track).toHaveBeenCalledWith(
      'chat_intent',
      expect.objectContaining({ first_source: 'unknown', landing_path: 'unknown' })
    )
  })
})
