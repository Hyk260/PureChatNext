import { SettingsEmptyPage } from '@/features/settings/SettingsEmptyPage'

export function createSettingsEmptyPage(title: string) {
  function Page() {
    return <SettingsEmptyPage />
  }
  Page.displayName = `SettingsEmpty(${title})`
  return Page
}

export const AppearancePage = createSettingsEmptyPage('外观')
export const LanguagePage = createSettingsEmptyPage('语言')
export const HotkeyPage = createSettingsEmptyPage('快捷键')
export const NotificationPage = createSettingsEmptyPage('通知')
export const StatsPage = createSettingsEmptyPage('数据统计')
export const AdvancedPage = createSettingsEmptyPage('高级设置')
export const StoragePage = createSettingsEmptyPage('数据存储')
export const MemoryPage = createSettingsEmptyPage('记忆设置')
export const CredsPage = createSettingsEmptyPage('凭证管理')
export const AboutPage = createSettingsEmptyPage('关于')
export const ConnectorPage = createSettingsEmptyPage('连接器')
export const SkillPage = createSettingsEmptyPage('技能')
export const ServiceModelPage = createSettingsEmptyPage('服务模型')
