'use client'

import { FileIcon as LucideFile, FileImage, FileText, FileVideo, FolderIcon, Music } from 'lucide-react'
import { memo } from 'react'

import { DOCUMENT_FOLDER_TYPE } from '@/const/resources/fileTypes'

interface FileIconProps {
  fileType: string
  size?: number
}

const FileIcon = memo<FileIconProps>(({ fileType, size = 20 }) => {
  if (fileType === DOCUMENT_FOLDER_TYPE) {
    return <FolderIcon size={size} />
  }
  if (fileType.startsWith('image/')) {
    return <FileImage size={size} />
  }
  if (fileType.startsWith('video/')) {
    return <FileVideo size={size} />
  }
  if (fileType.startsWith('audio/')) {
    return <Music size={size} />
  }
  if (fileType.startsWith('text/') || fileType.includes('pdf')) {
    return <FileText size={size} />
  }
  return <LucideFile size={size} />
})

FileIcon.displayName = 'FileIcon'

export default FileIcon
