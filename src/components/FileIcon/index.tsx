'use client'

import { FileTypeIcon, MaterialFileTypeIcon } from '@pure/ui'
import { memo } from 'react'

import { DOCUMENT_FOLDER_TYPE } from '@/const/resources/fileTypes'

import { mimeTypeMap } from './config'

interface FileIconProps {
  fileName: string
  fileType?: string
  isDirectory?: boolean
  size?: number
  variant?: 'raw' | 'file' | 'folder'
}

const FileIcon = memo<FileIconProps>(({ fileName, fileType, size, variant = 'raw', isDirectory }) => {
  if (isDirectory || fileType === DOCUMENT_FOLDER_TYPE) {
    return (
      <MaterialFileTypeIcon
        fallbackUnknownType={false}
        filename={fileName}
        size={size}
        type='folder'
        variant={variant}
      />
    )
  }

  const ext = Object.keys(mimeTypeMap).find((key) => fileName.toLowerCase().endsWith(`.${key}`))
  if (ext) {
    return <FileTypeIcon color={mimeTypeMap[ext]} filetype={ext.toUpperCase()} size={size} type='file' />
  }

  return <MaterialFileTypeIcon filename={fileName} size={size} type='file' variant={variant} />
})

FileIcon.displayName = 'FileIcon'

export default FileIcon
