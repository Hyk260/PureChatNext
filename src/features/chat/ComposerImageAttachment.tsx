'use client'

import { ActionIcon, useImagePreview } from '@lobehub/ui'
import { X } from 'lucide-react'
import { memo, useEffect, useRef } from 'react'

const ComposerImageAttachment = memo<{ file: File; onRemove: () => void }>(({ file, onRemove }) => {
  const imageRef = useRef<HTMLImageElement>(null)
  const { open, outlet } = useImagePreview(imageRef)

  useEffect(() => {
    const source = URL.createObjectURL(file)
    if (imageRef.current) imageRef.current.src = source
    return () => URL.revokeObjectURL(source)
  }, [file])

  return (
    <div className='relative size-30 shrink-0'>
      <button
        aria-label='预览图片'
        className='block size-full cursor-zoom-in overflow-hidden rounded-xl border border-border bg-secondary'
        type='button'
        onClick={open}
      >
        <img ref={imageRef} alt='待发送图片' className='size-full object-cover' />
      </button>
      <div className='absolute -right-1.5 -top-1.5 z-10'>
        <ActionIcon
          aria-label={`删除 ${file.name}`}
          className='rounded-full border-2 border-background bg-foreground text-background'
          icon={X}
          size={{ blockSize: 24, borderRadius: '50%', size: 14 }}
          title='移除图片'
          variant='filled'
          onClick={onRemove}
        />
      </div>
      {outlet}
    </div>
  )
})

ComposerImageAttachment.displayName = 'ComposerImageAttachment'

export default ComposerImageAttachment
