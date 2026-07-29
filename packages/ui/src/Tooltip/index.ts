/**
 * Bridge over `@lobehub/ui` Tooltip.
 * Call sites should import from `@pure/ui`; swap for a local implementation later.
 *
 * lobehub Tooltip 基于 Base UI，API 与 antd Tooltip 基本兼容（`title` / `placement` /
 * `open` / `onOpenChange` 等）。
 */
export { Tooltip, type TooltipPlacement, type TooltipProps } from '@lobehub/ui'
