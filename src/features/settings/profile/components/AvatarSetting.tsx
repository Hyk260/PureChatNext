'use client'

import { Spin } from 'antd'
import { useApp } from '@/components/AntdStaticMethods'
import { Loader2, Pencil } from 'lucide-react'
import { useRef, useState, type ChangeEvent } from 'react'

import { SettingRow } from './SettingRow'

interface AvatarSettingProps {
  avatar: string | null
  displayName: string
  initials: string
  s3Configured: boolean
  onUploaded: (avatar: string) => void
}

export function AvatarSetting({ avatar, displayName, initials, onUploaded, s3Configured }: AvatarSettingProps) {
  const { message } = useApp()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) return

    setUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/webapi/user/avatar', {
        body: formData,
        method: 'POST',
      })

      const data = (await response.json()) as { avatar?: string; error?: string }

      if (!response.ok) {
        message.error(data.error ?? '头像上传失败')
        return
      }

      if (data.avatar) {
        onUploaded(data.avatar)
        message.success('头像已更新')
      }
    } catch {
      message.error('头像上传失败')
    } finally {
      setUploading(false)
    }
  }

  const avatarContent = (
    <button
      className='group relative shrink-0 cursor-pointer overflow-hidden rounded-lg disabled:cursor-not-allowed disabled:opacity-50'
      disabled={!s3Configured || uploading}
      onClick={() => inputRef.current?.click()}
      title={s3Configured ? '点击上传头像' : '头像上传需配置 S3'}
      type='button'
    >
      {avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt={displayName} className='h-10 w-10 rounded-lg object-cover' src={avatar} />
      ) : (
        <div className='flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-sm font-semibold text-primary'>
          {initials}
        </div>
      )}
      {s3Configured ? (
        <div className='absolute inset-0 flex items-center justify-center rounded-lg bg-black/45 opacity-0 transition-opacity group-hover:opacity-100'>
          <Pencil className='h-4 w-4 text-white' />
        </div>
      ) : null}
    </button>
  )

  return (
    <SettingRow
      action={
        <Spin indicator={<Loader2 className='h-4 w-4 animate-spin' />} spinning={uploading}>
          {avatarContent}
        </Spin>
      }
      label='头像'
    >
      <input
        accept='image/jpeg,image/png,image/webp,image/gif'
        className='hidden'
        onChange={handleFileChange}
        ref={inputRef}
        type='file'
      />
    </SettingRow>
  )
}
