'use client'

import { useRef, useState } from 'react'

import { message } from '@/components/AntdStaticMethods'

import { SettingRow } from './SettingRow'

interface AvatarSettingProps {
  avatar: string | null
  displayName: string
  initials: string
  s3Configured: boolean
  onUploaded: (avatar: string) => void
}

export function AvatarSetting({
  avatar,
  displayName,
  initials,
  onUploaded,
  s3Configured,
}: AvatarSettingProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
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

  return (
    <SettingRow label="头像">
      <button
        className="relative shrink-0 disabled:opacity-50"
        disabled={!s3Configured || uploading}
        onClick={() => inputRef.current?.click()}
        title={s3Configured ? '点击上传头像' : '头像上传需配置 S3'}
        type="button"
      >
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt={displayName}
            className="h-10 w-10 rounded-full object-cover ring-2 ring-border"
            src={avatar}
          />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-primary ring-2 ring-border">
            {initials}
          </div>
        )}
        {uploading ? (
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-background/70 text-xs">
            …
          </span>
        ) : null}
      </button>
      <input
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleFileChange}
        ref={inputRef}
        type="file"
      />
    </SettingRow>
  )
}
