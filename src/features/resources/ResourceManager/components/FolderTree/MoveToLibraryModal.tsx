'use client'

import { Modal } from '@pure/ui'
import { memo } from 'react'

import { useResourceStore, revalidateResources } from '@/features/resources/store/resourceStore'
import { resourceService } from '@/services/resource'

interface MoveToLibraryModalProps {
  fileIds: string[]
  onClose: () => void
  open: boolean
}

const MoveToLibraryModal = memo<MoveToLibraryModalProps>(({ fileIds, onClose, open }) => {
  const knowledgeBases = useResourceStore((s) => s.knowledgeBases)

  const handleSelect = async (kbId: string) => {
    await resourceService.addFilesToKnowledgeBase(kbId, fileIds)
    revalidateResources()
    onClose()
  }

  return (
    <Modal footer={null} open={open} title='移动到知识库' onCancel={onClose}>
      {knowledgeBases.map((kb) => (
        <div key={kb.id} className='cursor-pointer py-2' onClick={() => handleSelect(kb.id)}>
          {kb.name}
        </div>
      ))}
    </Modal>
  )
})

MoveToLibraryModal.displayName = 'MoveToLibraryModal'

export default MoveToLibraryModal
