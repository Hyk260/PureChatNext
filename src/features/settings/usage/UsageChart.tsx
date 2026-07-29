'use client'

import { Empty } from 'antd'
import { useId, useMemo } from 'react'

const WIDTH = 900
const HEIGHT = 250
const PAD = { bottom: 34, left: 44, right: 18, top: 18 }

export function UsageChart({ data }: { data: { credits: number; day: string }[] }) {
  const gradientId = useId().replaceAll(':', '')
  const chart = useMemo(() => {
    if (!data.length) return null
    const max = Math.max(4, ...data.map((item) => item.credits))
    const plotWidth = WIDTH - PAD.left - PAD.right
    const plotHeight = HEIGHT - PAD.top - PAD.bottom
    const points = data.map((item, index) => ({
      ...item,
      x: PAD.left + (index / Math.max(1, data.length - 1)) * plotWidth,
      y: PAD.top + plotHeight - (item.credits / max) * plotHeight,
    }))
    return { max, plotHeight, points }
  }, [data])

  if (!chart || data.every((item) => item.credits === 0)) {
    return <Empty description='本周期暂无积分消耗' image={Empty.PRESENTED_IMAGE_SIMPLE} />
  }

  const line = chart.points.map((point) => `${point.x},${point.y}`).join(' ')
  const area = `${PAD.left},${HEIGHT - PAD.bottom} ${line} ${WIDTH - PAD.right},${HEIGHT - PAD.bottom}`

  return (
    <svg aria-label='每日积分消耗趋势' role='img' style={{ display: 'block', maxHeight: 280, width: '100%' }} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
      <defs>
        <linearGradient id={gradientId} x1='0' x2='0' y1='0' y2='1'>
          <stop offset='0%' stopColor='var(--ant-color-primary)' stopOpacity='0.25' />
          <stop offset='100%' stopColor='var(--ant-color-primary)' stopOpacity='0.02' />
        </linearGradient>
      </defs>
      {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
        const y = PAD.top + chart.plotHeight * ratio
        return (
          <g key={ratio}>
            <line stroke='var(--ant-color-border-secondary)' x1={PAD.left} x2={WIDTH - PAD.right} y1={y} y2={y} />
            <text fill='var(--ant-color-text-tertiary)' fontSize='11' textAnchor='end' x={PAD.left - 10} y={y + 4}>
              {Math.round(chart.max * (1 - ratio)).toLocaleString('zh-CN')}
            </text>
          </g>
        )
      })}
      <polygon fill={`url(#${gradientId})`} points={area} />
      <polyline fill='none' points={line} stroke='var(--ant-color-primary)' strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' />
      {chart.points.map((point, index) =>
        index % Math.max(1, Math.ceil(data.length / 8)) === 0 || index === data.length - 1 ? (
          <text fill='var(--ant-color-text-tertiary)' fontSize='11' key={point.day} textAnchor='middle' x={point.x} y={HEIGHT - 10}>
            {point.day.slice(5)}
          </text>
        ) : null
      )}
    </svg>
  )
}
