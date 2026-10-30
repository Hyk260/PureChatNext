import AppearanceSettingsContent from '@/features/settings/appearance/AppearanceSettingsContent'
import AdvancedSettingsContent from '@/features/settings/advanced/AdvancedSettingsContent'
import { SettingsEmptyPage } from '@/features/settings/SettingsEmptyPage'

export function createSettingsEmptyPage(title: string) {
  function Page() {
    return <SettingsEmptyPage />
  }
  Page.displayName = `SettingsEmpty(${title})`
  return Page
}

export const AppearancePage = AppearanceSettingsContent
export const LanguagePage = createSettingsEmptyPage('语言')
export const HotkeyPage = createSettingsEmptyPage('快捷键')
export const NotificationPage = createSettingsEmptyPage('通知')
export const StatsPage = createSettingsEmptyPage('数据统计')
export const AdvancedPage = AdvancedSettingsContent
export const StoragePage = createSettingsEmptyPage('数据存储')
export const MemoryPage = createSettingsEmptyPage('记忆设置')
export const CredsPage = createSettingsEmptyPage('凭证管理')
export const ConnectorPage = createSettingsEmptyPage('连接器')
