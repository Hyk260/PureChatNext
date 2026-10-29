'use client'

import { Button, Popover, Select, Text } from '@lobehub/ui'
import { Flex } from '@pure/ui'
import { CalendarClock, ChevronDown, SlidersHorizontal } from 'lucide-react'
import { useState } from 'react'
import type { TaskSchedule } from '@pure/types'
import { formatTaskSchedule, nextTaskRun } from '@pure/utils/taskSchedule'
import { formatTaskDate } from './presentation'

const FREQUENCIES = [
  { label: '每日', value: 'daily' },
  { label: '每小时', value: 'hourly' },
  { label: '每周', value: 'weekly' },
]
const WEEKDAYS = [
  { day: 1, label: '一' },
  { day: 2, label: '二' },
  { day: 3, label: '三' },
  { day: 4, label: '四' },
  { day: 5, label: '五' },
  { day: 6, label: '六' },
  { day: 0, label: '日' },
]
const TIMEZONES = [...new Set(['Asia/Shanghai', 'UTC', ...Intl.supportedValuesOf('timeZone')])].map((value) => ({
  value,
  label: value === 'Asia/Shanghai' ? 'Asia/Shanghai · 上海' : value.replaceAll('_', ' '),
}))
const pad = (value: number) => String(value).padStart(2, '0')
const HALF_HOUR_TIMES = Array.from(
  { length: 48 },
  (_, index) => `${pad(Math.floor(index / 2))}:${index % 2 ? '30' : '00'}`
)
const MINUTES = Array.from({ length: 60 }, (_, minute) => ({ value: minute, label: `第 ${pad(minute)} 分` }))

function dailyTimeOptions(current: string) {
  const options = new Set(HALF_HOUR_TIMES)
  options.add(current)
  return [...options].sort().map((time) => ({ value: time, label: time }))
}

function changeFrequency(current: TaskSchedule, frequency: TaskSchedule['frequency']): TaskSchedule {
  const base = { minute: current.minute, timezone: current.timezone }
  if (frequency === 'hourly') return { ...base, frequency }
  const hour = current.frequency === 'hourly' ? 9 : current.hour
  if (frequency === 'daily') return { ...base, frequency, hour }
  return { ...base, frequency, hour, weekdays: current.frequency === 'weekly' ? current.weekdays : [1] }
}

function nextLabel(value: TaskSchedule) {
  try {
    return `下次运行：${formatTaskDate(nextTaskRun(value).toISOString(), value.timezone)}`
  } catch {
    return '请完成排期设置'
  }
}

export function TaskSchedulePicker({
  value,
  onChange,
}: {
  value: TaskSchedule
  onChange: (value: TaskSchedule) => void
}) {
  const [advanced, setAdvanced] = useState(false)
  const time = value.frequency === 'hourly' ? '' : `${pad(value.hour)}:${pad(value.minute)}`
  const toggleDay = (day: number) => {
    if (value.frequency !== 'weekly') return
    const selected = value.weekdays.includes(day)
    if (selected && value.weekdays.length === 1) return
    const weekdays = selected ? value.weekdays.filter((item) => item !== day) : [...value.weekdays, day]
    onChange({ ...value, weekdays })
  }
  const content = (
    <div className='space-y-6'>
      <Text as='h3' className='m-0 text-xl font-semibold'>
        定时任务
      </Text>
      <div className='grid grid-cols-1 gap-5 sm:grid-cols-2'>
        <label className='space-y-2'>
          <Text as='span' className='block text-sm text-muted-foreground'>
            运行频率
          </Text>
          <Select
            value={value.frequency}
            options={FREQUENCIES}
            onChange={(next) => {
              if (next === 'daily' || next === 'hourly' || next === 'weekly') onChange(changeFrequency(value, next))
            }}
            className='w-full'
            variant='filled'
          />
        </label>
        <label className='space-y-2'>
          <Text as='span' className='block text-sm text-muted-foreground'>
            {value.frequency === 'hourly' ? '触发分钟' : '时间'}
          </Text>
          {value.frequency === 'hourly' ? (
            <Select
              value={value.minute}
              className='w-full'
              variant='filled'
              options={MINUTES}
              onChange={(minute) => {
                if (typeof minute === 'number') onChange({ ...value, minute })
              }}
            />
          ) : (
            <Select
              aria-label='运行时间'
              className='w-full'
              variant='filled'
              value={time}
              options={dailyTimeOptions(time)}
              onChange={(next) => {
                if (typeof next !== 'string') return
                const [hourText, minuteText] = next.split(':')
                const hour = Number(hourText)
                const minute = Number(minuteText)
                if (!Number.isInteger(hour) || !Number.isInteger(minute)) return
                onChange({ ...value, hour, minute })
              }}
            />
          )}
        </label>
      </div>
      {value.frequency === 'weekly' && (
        <div className='space-y-2' aria-label='星期'>
          <Text as='span' className='block text-sm text-muted-foreground'>
            星期
          </Text>
          <Flex className='flex-wrap gap-1 rounded-2xl bg-muted p-1'>
            {WEEKDAYS.map(({ day, label }) => {
              const checked = value.weekdays.includes(day)
              return (
                <Button
                  key={day}
                  aria-pressed={checked}
                  className='min-w-12'
                  shape='round'
                  type={checked ? 'primary' : 'text'}
                  onClick={() => toggleDay(day)}
                >
                  {label}
                </Button>
              )
            })}
          </Flex>
          <Text as='span' className='block text-xs text-muted-foreground'>
            至少选择一天
          </Text>
        </div>
      )}
      <div className='space-y-4 border-t border-border pt-4'>
        <Button type='text' size='small' onClick={() => setAdvanced(!advanced)}>
          <SlidersHorizontal size={14} />
          高级设置
          <ChevronDown size={14} className={advanced ? 'rotate-180 transition-transform' : 'transition-transform'} />
        </Button>
        {advanced && (
          <label className='block max-w-sm space-y-2'>
            <Text as='span' className='block text-sm text-muted-foreground'>
              时区
            </Text>
            <Select
              showSearch
              className='w-full'
              value={value.timezone}
              options={TIMEZONES}
              onChange={(timezone) => {
                if (typeof timezone === 'string') onChange({ ...value, timezone })
              }}
            />
          </label>
        )}
        <Text as='p' className='m-0 text-xs text-muted-foreground'>
          {nextLabel(value)} · {value.timezone}
        </Text>
      </div>
    </div>
  )
  return (
    <Popover content={content} trigger='click' placement='bottomLeft'>
      <Button type='text' size='small' title={value.timezone}>
        <CalendarClock size={15} />
        {formatTaskSchedule(value)}
      </Button>
    </Popover>
  )
}
