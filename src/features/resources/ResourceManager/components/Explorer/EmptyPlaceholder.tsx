'use client'

import { Center, FileTypeIcon, Icon, Text, Flex } from '@pure/ui'
import { createStaticStyles, cssVar } from 'antd-style'
import { ArrowUpIcon } from 'lucide-react'
import { memo, useRef } from 'react'
import type { ChangeEvent } from 'react'

const ICON_SIZE = 80

const styles = createStaticStyles(({ css }) => ({
  actionTitle: css`
    margin-block-start: 12px;
    font-size: 16px;
    color: ${cssVar.colorTextSecondary};
  `,
  card: css`
    cursor: pointer;

    position: relative;

    overflow: hidden;

    width: 200px;
    height: 140px;
    border-radius: ${cssVar.borderRadiusLG};

    font-weight: 500;
    text-align: center;

    background: ${cssVar.colorFillTertiary};
    box-shadow: 0 0 0 1px ${cssVar.colorFillTertiary} inset;

    transition: background 0.3s ease-in-out;

    &:hover {
      background: ${cssVar.colorFillSecondary};
    }
  `,
  glow: css`
    position: absolute;
    inset-block-end: -12px;
    inset-inline-end: 0;

    width: 48px;
    height: 48px;

    opacity: 0.5;
    filter: blur(24px);
  `,
  icon: css`
    position: absolute;
    z-index: 1;
    inset-block-end: -24px;
    inset-inline-end: 8px;

    flex: none;
  `,
}))

interface EmptyPlaceholderProps {
  onUpload: (files: File[]) => void | Promise<void>
}

const EmptyPlaceholder = memo<EmptyPlaceholderProps>(({ onUpload }) => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length) onUpload(files)
    e.target.value = ''
  }

  return (
    <Center gap={24} height='100%' style={{ paddingBottom: 100 }} width='100%'>
      <Flex className='flex-col justify-center' style={{ textAlign: 'center' }}>
        <Text>把文件或文件夹拖到这里</Text>
        <Text type='secondary'>或者</Text>
      </Flex>
      <Flex className='flex-row gap-3'>
        <Flex className={[styles.card, 'flex-col p-4']} onClick={() => fileInputRef.current?.click()}>
          <span className={styles.actionTitle}>上传文件</span>
          <div className={styles.glow} style={{ background: cssVar.gold }} />
          <FileTypeIcon
            className={styles.icon}
            color={cssVar.gold}
            icon={<Icon color='#fff' icon={ArrowUpIcon} />}
            size={ICON_SIZE}
          />
        </Flex>
        <Flex className={[styles.card, 'flex-col p-4']} onClick={() => folderInputRef.current?.click()}>
          <span className={styles.actionTitle}>上传文件夹</span>
          <div className={styles.glow} style={{ background: cssVar.geekblue }} />
          <FileTypeIcon
            className={styles.icon}
            color={cssVar.geekblue}
            icon={<Icon color='#fff' icon={ArrowUpIcon} />}
            size={ICON_SIZE}
            type='folder'
          />
        </Flex>
      </Flex>
      <input ref={fileInputRef} hidden multiple type='file' onChange={handleFileChange} />
      <input
        ref={folderInputRef}
        hidden
        multiple
        type='file'
        // @ts-expect-error webkitdirectory is not in React types
        webkitdirectory=''
        onChange={handleFileChange}
      />
    </Center>
  )
})

EmptyPlaceholder.displayName = 'EmptyPlaceholder'

export default EmptyPlaceholder
