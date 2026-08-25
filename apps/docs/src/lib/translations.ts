import { defineTranslations } from 'fumadocs-core/i18n'
import { i18nProvider, uiTranslations } from 'fumadocs-ui/i18n'

const translations = defineTranslations()
  .extend(uiTranslations())
  .add({
    'Back to Home(404 not found page)': '返回文档首页',
    'Close Search(search dialog)(aria-label)': '关闭搜索',
    'Close Sidebar(aria-label)': '关闭侧栏',
    'Collapse Sidebar(sidebar)(aria-label)': '收起侧栏',
    'Copied Text(code block)(aria-label)': '已复制代码',
    'Copy Anchor Link(heading anchor)(aria-label)': '复制标题链接',
    'Copy Link(accordion)(aria-label)': '复制链接',
    'Copy Text(code block)(aria-label)': '复制代码',
    'Dark(theme switcher)(aria-label)': '深色模式',
    'Edit on GitHub(edit page)': '在 GitHub 编辑此页',
    'Light(theme switcher)(aria-label)': '浅色模式',
    'Next Page(pagination)': '下一篇',
    'No Headings(table of contents)': '本页没有小节',
    'No results found(search dialog)': '没有找到相关文档',
    'On this page(table of contents)': '本页内容',
    'Open Search(search trigger)(aria-label)': '打开搜索',
    'Open Sidebar(aria-label)': '打开侧栏',
    'Page Not Found(404 not found page)': '页面不存在',
    'Previous Page(pagination)': '上一篇',
    'Search(search dialog)': '搜索文档',
    'Search(search trigger)': '搜索文档',
    'System(theme switcher)(aria-label)': '跟随系统',
    'The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.(404 not found page)':
      '你访问的文档可能已移动、更名或暂时不可用。',
    'Toggle Theme(theme switcher)(aria-label)': '切换主题',
  })

export const docsI18n = i18nProvider(translations)
