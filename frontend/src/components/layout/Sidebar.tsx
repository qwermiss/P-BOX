import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { useSidebar } from './Layout'
import {
  LayoutDashboard,
  Globe,
  ListTree,
  Link2,
  Wrench,
  FileCode,
  Cpu,
  Settings,
  ArrowLeftRight,
  FileText,
  Database,
  X,
} from 'lucide-react'

const navItems = [
  // 主控制
  { path: '/', icon: LayoutDashboard, labelKey: 'nav.dashboard' },
  { path: '/proxy-switch', icon: ArrowLeftRight, labelKey: 'nav.proxySwitch' },
  // 资源管理
  { path: '/subscriptions', icon: ListTree, labelKey: 'nav.subscriptions' },
  { path: '/nodes', icon: Globe, labelKey: 'nav.nodes' },
  // 配置
  { path: '/config-generator', icon: FileCode, labelKey: 'nav.configGenerator' },
  { path: '/ruleset', icon: Database, labelKey: 'nav.ruleset' },
  // 监控
  { path: '/connections', icon: Link2, labelKey: 'nav.connections' },
  { path: '/logs', icon: FileText, labelKey: 'nav.logs' },
  // 系统
  { path: '/core-manage', icon: Cpu, labelKey: 'nav.coreManage' },
  { path: '/tools', icon: Wrench, labelKey: 'nav.tools' },
  { path: '/settings', icon: Settings, labelKey: 'nav.settings' },
]

export default function Sidebar() {
  const location = useLocation()
  const { t } = useTranslation()
  const { isOpen, close } = useSidebar()

  return (
    <aside className={cn(
      'w-64 border-r border-border bg-card flex flex-col flex-shrink-0',
      // 移动端：固定定位，通过 isOpen 控制显示
      'fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 lg:relative lg:translate-x-0',
      isOpen ? 'translate-x-0' : '-translate-x-full'
    )}>
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 lg:px-6 border-b border-border">
        <div className="flex items-center">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center mr-3">
            <span className="text-primary-foreground font-bold text-lg">P</span>
          </div>
          <span className="text-xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
            P-BOX
          </span>
        </div>
        {/* 移动端关闭按钮 */}
        <button 
          onClick={close}
          className="p-2 rounded-lg hover:bg-muted lg:hidden"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* 导航菜单 */}
      <nav className="flex-1 p-2 lg:p-4 space-y-0.5 lg:space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = location.pathname === item.path

          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={close}
              className={cn(
                'flex items-center gap-2 lg:gap-3 px-3 py-2 lg:py-2.5 rounded-lg transition-all duration-200 text-sm lg:text-base',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
            >
              <Icon className="w-4 h-4 lg:w-5 lg:h-5 flex-shrink-0" />
              <span className="font-medium truncate">{t(item.labelKey)}</span>
            </Link>
          )
        })}
      </nav>

      {/* 底部版本信息 */}
      <div className="p-4 border-t border-border">
        <div className="text-xs text-muted-foreground text-center">
          P-BOX v0.1.0
        </div>
      </div>
    </aside>
  )
}
