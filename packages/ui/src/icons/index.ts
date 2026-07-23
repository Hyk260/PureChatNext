/**
 * Bridge over `@lobehub/icons` brand/model icons.
 * No antd equivalent; keep lobehub bridge until self-hosted icons are ready.
 * Call sites should import from `@pure/ui` or `@pure/ui/icons`.
 */
export { Github, ModelIcon, ModelTag, ProviderCombine, ProviderIcon } from '@lobehub/icons'

/**
 * Bridge over `@lobehub/ui/icons` messenger / platform icons.
 * These brand avatars (Discord, QQ, Slack, Telegram, WeChat) only ship in
 * `@lobehub/ui/icons`; re-export here so call sites import from `@pure/ui`.
 *
 * `ProviderIconLucide` is the lucide-style `ProviderIcon` from
 * `@lobehub/ui/icons` lucideExtra (a hand/robot glyph). It is distinct from the
 * brand `ProviderIcon` re-exported above from `@lobehub/icons`, which takes a
 * `provider` prop and renders a per-provider logo. Use the lucide variant for
 * generic nav/icon slots that expect a `lucide-react`-compatible component.
 */
export { Discord, QQ, Slack, Telegram, WeChat } from '@lobehub/ui/icons'
export { ProviderIcon as ProviderIconLucide } from '@lobehub/ui/icons'
