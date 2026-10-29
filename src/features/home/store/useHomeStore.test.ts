import { describe, expect, it } from 'vitest'

import { useHomeStore } from './useHomeStore'

describe('home UI persistence migration', () => {
  it('discards old persisted assistant content while retaining the selected instance and preferences', async () => {
    const migrate = useHomeStore.persist.getOptions().migrate!
    const migrated = await migrate(
      {
        activeAgent: { identifier: 'old-instance', systemRole: 'stale prompt' },
        selectedAgentId: 'old-instance',
        selectedModel: 'my-model',
        selectedProvider: 'openai',
        agentGroups: [{ id: 'work', name: '工作', sort: 0 }],
      },
      2
    )
    expect(migrated).not.toHaveProperty('activeAgent')
    expect(migrated).toMatchObject({
      selectedAgentId: 'old-instance',
      selectedModel: 'my-model',
      selectedProvider: 'openai',
      agentGroups: [{ id: 'work', name: '工作', sort: 0 }],
    })
  })
})
