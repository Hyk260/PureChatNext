/**
 * Bridge over `@lobehub/ui` Popover.
 * Call sites should import from `@pure/ui`; swap for a local implementation later.
 *
 * lobehub Popover 基于 Base UI 实现，API 与 antd Popover 基本兼容
 * （content / open / placement / trigger / onOpenChange / styles.content 等），
 * 但默认 trigger 为 'hover'，使用时按需显式指定。
 */
export { Popover, type PopoverProps, type PopoverPlacement, type PopoverTrigger } from '@lobehub/ui'
