'use client'

import { Icon } from '@lobehub/ui'
import { FileIcon as LucideFile, FileImage, FileText, FileVideo, FolderIcon, Music } from 'lucide-react'
import { memo } from 'react'

import { DOCUMENT_FOLDER_TYPE } from '@/const/resources/fileTypes'

interface FileIconProps {
  fileType: string
  size?: number
}

const FileIcon = memo<FileIconProps>(({ fileType, size = 20 }) => {
  if (fileType === DOCUMENT_FOLDER_TYPE) {
    return <Icon icon={FolderIcon} size={size} />
  }
  if (fileType.startsWith('image/')) {
    return <Icon icon={FileImage} size={size} />
  }
  if (fileType.startsWith('video/')) {
    return <Icon icon={FileVideo} size={size} />
  }
  if (fileType.startsWith('audio/')) {
    return <Icon icon={Music} size={size} />
  }
  if (fileType.startsWith('text/') || fileType.includes('pdf')) {
    return <Icon icon={FileText} size={size} />
  }
  return <Icon icon={LucideFile} size={size} />
})

FileIcon.displayName = 'FileIcon'

export default FileIcon
