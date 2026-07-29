'use client'

import { type IconProps } from '@pure/ui'
import {
  BellIcon,
  Blocks,
  Brain,
  BrainCircuit,
  ChartColumnBigIcon,
  Coins,
  Database,
  EllipsisIcon,
  Info,
  KeyboardIcon,
  KeyRound,
  Languages,
  UserIcon,
  Link2,
  MessageCircleIcon,
  PaletteIcon,
  Sparkles,
} from 'lucide-react'
import { useMemo } from 'react'

export enum SettingsGroupKey {
  Agent = 'agent',
  General = 'general',
  System = 'system',
}

export enum SettingsTab {
  About = 'about',
  Advanced = 'advanced',
  Appearance = 'appearance',
  Connector = 'connector',
  Credits = 'credits',
  Creds = 'creds',
  Hotkey = 'hotkey',
  Language = 'language',
  Memory = 'memory',
  Messenger = 'messenger',
  Notification = 'notification',
  Profile = 'profile',
  Provider = 'provider',
  ServiceModel = 'service-model',
  Skill = 'skill',
  Stats = 'stats',
  Storage = 'storage',
  Usage = 'usage',
}

export interface SettingsCategoryItem {
  href: string
  icon?: IconProps['icon']
  key: SettingsTab
  label: string
}

export interface SettingsCategoryGroup {
  items: SettingsCategoryItem[]
  key: SettingsGroupKey
  title: string
}

const tabHref = (tab: SettingsTab) => `/settings/${tab}`

export const SETTINGS_EMPTY_TABS = [
  SettingsTab.Stats,
  SettingsTab.Appearance,
  SettingsTab.Language,
  SettingsTab.Hotkey,
  SettingsTab.Notification,
  SettingsTab.ServiceModel,
  SettingsTab.Skill,
  SettingsTab.Connector,
  SettingsTab.Memory,
  SettingsTab.Creds,
  SettingsTab.Storage,
  SettingsTab.Advanced,
  SettingsTab.About,
] as const

export function useSettingsCategory(): SettingsCategoryGroup[] {
  return useMemo(
    () => [
      {
        items: [
          {
            href: tabHref(SettingsTab.Profile),
            icon: UserIcon,
            key: SettingsTab.Profile,
            label: '个人资料',
          },
          {
            href: tabHref(SettingsTab.Stats),
            icon: ChartColumnBigIcon,
            key: SettingsTab.Stats,
            label: '数据统计',
          },
          {
            href: tabHref(SettingsTab.Credits),
            icon: Coins,
            key: SettingsTab.Credits,
            label: '免费积分',
          },
          {
            href: tabHref(SettingsTab.Usage),
            icon: ChartColumnBigIcon,
            key: SettingsTab.Usage,
            label: '用量',
          },
          {
            href: tabHref(SettingsTab.Appearance),
            icon: PaletteIcon,
            key: SettingsTab.Appearance,
            label: '外观',
          },
          // {
          //   href: tabHref(SettingsTab.Language),
          //   icon: Languages,
          //   key: SettingsTab.Language,
          //   label: '语言',
          // },
          // {
          //   href: tabHref(SettingsTab.Hotkey),
          //   icon: KeyboardIcon,
          //   key: SettingsTab.Hotkey,
          //   label: '快捷键',
          // },
          // {
          //   href: tabHref(SettingsTab.Notification),
          //   icon: BellIcon,
          //   key: SettingsTab.Notification,
          //   label: '通知',
          // },
        ],
        key: SettingsGroupKey.General,
        title: '通用',
      },
      {
        items: [
          {
            href: '/settings/provider/all',
            icon: Brain,
            key: SettingsTab.Provider,
            label: 'AI 服务商',
          },
          {
            href: tabHref(SettingsTab.ServiceModel),
            icon: Sparkles,
            key: SettingsTab.ServiceModel,
            label: '服务模型',
          },
          {
            href: tabHref(SettingsTab.Skill),
            icon: Blocks,
            key: SettingsTab.Skill,
            label: '技能',
          },
          // {
          //   href: tabHref(SettingsTab.Connector),
          //   icon: Link2,
          //   key: SettingsTab.Connector,
          //   label: '连接器',
          // },
          // {
          //   href: tabHref(SettingsTab.Memory),
          //   icon: BrainCircuit,
          //   key: SettingsTab.Memory,
          //   label: '记忆设置',
          // },
          // {
          //   href: tabHref(SettingsTab.Creds),
          //   icon: KeyRound,
          //   key: SettingsTab.Creds,
          //   label: '凭证管理',
          // },
          {
            href: tabHref(SettingsTab.Messenger),
            icon: MessageCircleIcon,
            key: SettingsTab.Messenger,
            label: '聊天平台',
          },
        ],
        key: SettingsGroupKey.Agent,
        title: '智能体',
      },
      {
        items: [
          // {
          //   href: tabHref(SettingsTab.Storage),
          //   icon: Database,
          //   key: SettingsTab.Storage,
          //   label: '数据存储',
          // },
          // {
          //   href: tabHref(SettingsTab.Advanced),
          //   icon: EllipsisIcon,
          //   key: SettingsTab.Advanced,
          //   label: '高级设置',
          // },
          {
            href: tabHref(SettingsTab.About),
            icon: Info,
            key: SettingsTab.About,
            label: '关于',
          },
        ],
        key: SettingsGroupKey.System,
        title: '系统',
      },
    ],
    []
  )
}
