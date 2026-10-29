import type { ComponentType, SVGProps } from 'react'

type PriorityIconProps = SVGProps<SVGSVGElement> & { size?: number | string }

export type PriorityIcon = ComponentType<PriorityIconProps>

export const PriorityNoneIcon = ({ size = 16, ...props }: PriorityIconProps) => (
  <svg aria-hidden='true' fill='currentColor' height={size} viewBox='0 0 16 16' width={size} {...props}>
    <path d='M2 7.25h2.5v1.5H2zm4.75 0h2.5v1.5h-2.5zm4.75 0H14v1.5h-2.5z' />
  </svg>
)

export const PriorityUrgentIcon = ({ size = 16, ...props }: PriorityIconProps) => (
  <svg aria-hidden='true' height={size} viewBox='0 0 16 16' width={size} {...props}>
    <rect fill='currentColor' height='14' rx='2' width='14' x='1' y='1' />
    <path d='M8 4v4.25M8 11.25v.1' stroke='white' strokeLinecap='round' strokeWidth='1.6' />
  </svg>
)

export const PriorityHighIcon = ({ size = 16, ...props }: PriorityIconProps) => (
  <svg aria-hidden='true' fill='currentColor' height={size} viewBox='0 0 16 16' width={size} {...props}>
    <rect height='5' rx='1' width='3' x='1.5' y='9' />
    <rect height='8' rx='1' width='3' x='6.5' y='6' />
    <rect height='11' rx='1' width='3' x='11.5' y='3' />
  </svg>
)

export const PriorityMediumIcon = ({ size = 16, ...props }: PriorityIconProps) => (
  <svg aria-hidden='true' fill='currentColor' height={size} viewBox='0 0 16 16' width={size} {...props}>
    <rect height='5' rx='1' width='3' x='1.5' y='9' />
    <rect height='8' rx='1' width='3' x='6.5' y='6' />
    <rect fillOpacity='.4' height='11' rx='1' width='3' x='11.5' y='3' />
  </svg>
)

export const PriorityLowIcon = ({ size = 16, ...props }: PriorityIconProps) => (
  <svg aria-hidden='true' fill='currentColor' height={size} viewBox='0 0 16 16' width={size} {...props}>
    <rect height='5' rx='1' width='3' x='1.5' y='9' />
    <rect fillOpacity='.4' height='8' rx='1' width='3' x='6.5' y='6' />
    <rect fillOpacity='.4' height='11' rx='1' width='3' x='11.5' y='3' />
  </svg>
)
