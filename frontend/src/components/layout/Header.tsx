import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
import { Sun, Moon, Monitor, Globe, Menu } from 'lucide-react'
import { useThemeStore, Theme } from '@/stores/themeStore'
import { useSidebar } from './Layout'

// 路由到标题的映射
const routeTitles: Record<string, string> = {
  '/': 'nav.dashboard',
  '/proxy-switch': 'nav.proxySwitch',
  '/nodes': 'nav.nodes',
  '/subscriptions': 'nav.subscriptions',
  '/connections': 'nav.connections',
  '/logs': 'nav.logs',
  '/ruleset': 'nav.ruleset',
  '/tools': 'nav.tools',
  '/config-generator': 'nav.configGenerator',
  '/core-manage': 'nav.coreManage',
  '/settings': 'nav.settings',
}

export default function Header() {
  const { t, i18n } = useTranslation()
  const { theme, setTheme } = useThemeStore()
  const location = useLocation()
  const { toggle } = useSidebar()

  // 获取当前页面标题
  const currentTitle = routeTitles[location.pathname] || 'nav.dashboard'

  const themes: { value: Theme; icon: typeof Sun; label: string }[] = [
    { value: 'light', icon: Sun, label: t('settings.themeLight') },
    { value: 'dark', icon: Moon, label: t('settings.themeDark') },
    { value: 'system', icon: Monitor, label: t('settings.themeSystem') },
  ]

  const languages = [
    { code: 'en', label: 'English', flag: '🇺🇸' },
    { code: 'zh', label: '中文', flag: '🇨🇳' },
  ]

  const toggleLanguage = () => {
    const newLang = i18n.language === 'zh' ? 'en' : 'zh'
    i18n.changeLanguage(newLang)
  }

  const cycleTheme = () => {
    const themeOrder: Theme[] = ['light', 'dark', 'system']
    const currentIndex = themeOrder.indexOf(theme)
    const nextIndex = (currentIndex + 1) % themeOrder.length
    setTheme(themeOrder[nextIndex])
  }

  const ThemeIcon = themes.find((t) => t.value === theme)?.icon || Sun

  return (
    <header className="h-14 lg:h-16 border-b border-border bg-card/50 backdrop-blur-sm flex items-center justify-between px-4 lg:px-6">
      {/* 左侧：汉堡菜单 + 标题 */}
      <div className="flex items-center gap-3">
        {/* 移动端汉堡菜单 */}
        <button
          onClick={toggle}
          className="p-2 -ml-2 rounded-lg hover:bg-muted transition-colors lg:hidden"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="text-lg lg:text-xl font-semibold truncate">{t(currentTitle)}</h1>
      </div>

      {/* 右侧按钮 */}
      <div className="flex items-center gap-1 lg:gap-2">
        {/* 语言切换 */}
        <button
          onClick={toggleLanguage}
          className="p-2 rounded-lg hover:bg-muted transition-colors flex items-center gap-1 lg:gap-2"
          title={t('settings.language')}
        >
          <Globe className="w-5 h-5" />
          <span className="text-sm font-medium hidden sm:inline">
            {languages.find((l) => l.code === i18n.language)?.flag}
          </span>
        </button>

        {/* 主题切换 */}
        <button
          onClick={cycleTheme}
          className="p-2 rounded-lg hover:bg-muted transition-colors"
          title={themes.find((t) => t.value === theme)?.label}
        >
          <ThemeIcon className="w-5 h-5" />
        </button>
      </div>
    </header>
  )
}
