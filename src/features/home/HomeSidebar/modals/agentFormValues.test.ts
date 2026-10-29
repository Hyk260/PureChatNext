import { describe, expect, it } from 'vitest'

import { profileFormValues } from './agentFormValues'

describe('assistant profile copying', () => {
  it('preserves the full saved profile, including more than three opening questions and the background', () => {
    const profile = {
      avatar: '📜',
      backgroundColor: '#ffffff',
      description: '原有介绍',
      openingMessage: '原有开场白',
      openingQuestions: ['问题一', '问题二', '问题三', '问题四'],
      systemRole: '原有提示词',
      title: '原有名称',
    }
    const form = profileFormValues(profile)
    expect(form).toEqual(profile)
    form.openingQuestions[0] = '已编辑'
    expect(profile.openingQuestions[0]).toBe('问题一')
  })

  it('provides editable defaults for legacy assistants without opening content', () => {
    expect(profileFormValues({ title: '旧助理', openingMessage: null, openingQuestions: null })).toMatchObject({
      title: '旧助理',
      avatar: '🤖',
      openingMessage: '',
      openingQuestions: ['', '', ''],
    })
  })
})
