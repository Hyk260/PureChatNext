/**
 * Bridge over `@lobehub/ui` Avatar.
 * Call sites should import from `@pure/ui`; swap for a local implementation later.
 *
 * lobehub Avatar 接受 `avatar`（字符串/URL/emoji/ReactNode）与 `background` props，
 * 会自动判断是图片还是 emoji/文本并正确渲染，比 antd Avatar 更适合 agent 头像场景。
 */
export { Avatar, AvatarGroup, type AvatarProps, type AvatarGroupProps } from '@lobehub/ui'
