/** Expose the shared Skeleton primitives through the application UI package. */
import { Skeleton as AntSkeleton } from 'antd'
import {
  Skeleton as LobeSkeleton,
  SkeletonAvatar,
  SkeletonBlock,
  SkeletonButton,
  SkeletonParagraph,
  SkeletonTags,
  SkeletonTitle,
} from '@lobehub/ui'
import type {
  SkeletonAvatarProps,
  SkeletonBlockProps,
  SkeletonButtonProps,
  SkeletonParagraphProps,
  SkeletonProps,
  SkeletonTagsProps,
  SkeletonTitleProps,
} from '@lobehub/ui'

type CompatibleSkeleton = typeof LobeSkeleton & {
  Input: typeof AntSkeleton.Input
}

const Skeleton = Object.assign(LobeSkeleton, {
  Input: AntSkeleton.Input,
}) as CompatibleSkeleton

export {
  Skeleton,
  SkeletonAvatar,
  type SkeletonAvatarProps,
  SkeletonBlock,
  type SkeletonBlockProps,
  SkeletonButton,
  type SkeletonButtonProps,
  SkeletonParagraph,
  type SkeletonParagraphProps,
  type SkeletonProps,
  SkeletonTags,
  type SkeletonTagsProps,
  SkeletonTitle,
  type SkeletonTitleProps,
}
