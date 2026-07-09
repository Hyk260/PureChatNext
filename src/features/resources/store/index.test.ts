import { beforeEach, describe, expect, it } from 'vitest'

import { useResourceManagerStore } from '@/features/resources/store'

describe('useResourceManagerStore selection', () => {
  beforeEach(() => {
    useResourceManagerStore.setState({
      selectAllState: 'none',
      selectedFileIds: [],
    })
  })

  it('toggleSelectFile adds and removes ids', () => {
    const { toggleSelectFile } = useResourceManagerStore.getState()

    toggleSelectFile('file-1')
    expect(useResourceManagerStore.getState().selectedFileIds).toEqual(['file-1'])

    toggleSelectFile('file-2')
    expect(useResourceManagerStore.getState().selectedFileIds).toEqual(['file-1', 'file-2'])

    toggleSelectFile('file-1')
    expect(useResourceManagerStore.getState().selectedFileIds).toEqual(['file-2'])
  })

  it('selectAllLoadedResources selects all loaded items', () => {
    const { selectAllLoadedResources } = useResourceManagerStore.getState()

    selectAllLoadedResources(['a', 'b', 'c'])
    expect(useResourceManagerStore.getState()).toMatchObject({
      selectAllState: 'loaded',
      selectedFileIds: ['a', 'b', 'c'],
    })
  })

  it('clearSelectAllState clears selection', () => {
    useResourceManagerStore.setState({
      selectAllState: 'loaded',
      selectedFileIds: ['a'],
    })

    useResourceManagerStore.getState().clearSelectAllState()
    expect(useResourceManagerStore.getState()).toMatchObject({
      selectAllState: 'none',
      selectedFileIds: [],
    })
  })
})
