import Image from 'next/image'

export function Brand() {
  return (
    <span className='flex items-center gap-2.5'>
      <span className='flex size-5 items-center justify-center rounded-xl bg-fd-secondary'>
        <Image alt='' aria-hidden height={13} priority src='/purechat-mark.svg' style={{ width: 'auto' }} width={21} />
      </span>
      <span className='flex flex-col leading-none'>
        <span className='text-sm font-semibold tracking-tight'>PureChat</span>
        <span className='mt-1 text-[11px] text-fd-muted-foreground'>Documentation</span>
      </span>
    </span>
  )
}
