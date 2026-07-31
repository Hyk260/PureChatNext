/**
 * Bridge over `@lobehub/ui` Tooltip.
 * Call sites should import from `@pure/ui`; swap for a local implementation later.
 *
 * lobehub Tooltip 基于 Base UI，API 与 antd Tooltip 基本兼容（`title` / `placement` /
 * `open` / `onOpenChange` 等）。
 */
import { Tooltip } from '@lobehub/ui'
import type { TooltipProps } from '@lobehub/ui'

export type TooltipPlacement = NonNullable<TooltipProps['placement']>

export { Tooltip, type TooltipProps }
