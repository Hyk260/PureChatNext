/**
 * Expose the shared EmojiPicker through the application UI package.
 * First open of emoji-mart is slow; the wrapper shows a panel spinner until it paints.
 */
export { EmojiPicker, EmojiPicker as default } from './EmojiPicker'
export type { EmojiPickerProps } from '@lobehub/ui'
