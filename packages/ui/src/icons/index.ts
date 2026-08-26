/**
 * Expose brand/model icons through the application UI package.
 * No antd equivalent exists; keep this adapter until self-hosted icons are ready.
 * Call sites should import from `@pure/ui` or `@pure/ui/icons`.
 *
 * `ProviderIcon` / `ProviderCombine` are wrapped to render PureChat brand assets
 * for `purechat`.
 */
export { Github, ModelIcon, ModelTag } from '@lobehub/icons'
export { default as ProviderCombine, type ProviderCombineProps } from './ProviderCombine'
export { default as ProviderIcon, type ProviderIconProps } from './ProviderIcon'
export { default as PureChatMark, type PureChatMarkProps, type PureChatMarkVariant } from './PureChatMark'

/**
 * Expose messenger and platform icons through the application UI package.
 * These brand avatars (Discord, QQ, Slack, Telegram, WeChat) only ship in
 * Re-export the icons here so call sites import from `@pure/ui`.
 *
 * `ProviderIconLucide` is the lucide-style `ProviderIcon` from
 * lucideExtra (a hand/robot glyph). It is distinct from the
 * brand `ProviderIcon` re-exported above, which takes a
 * `provider` prop and renders a per-provider logo. Use the lucide variant for
 * generic nav/icon slots that expect a `lucide-react`-compatible component.
 */
export { Discord, QQ, Slack, Telegram, WeChat } from '@lobehub/ui/icons'
export { ProviderIcon as ProviderIconLucide } from '@lobehub/ui/icons'
