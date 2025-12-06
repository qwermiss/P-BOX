import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { 
  Sun, Moon, Monitor, Globe, Zap, Server, Loader2, 
  Palette, Network, Info, Shield, Cpu,
  Power, ArrowUpDown, Gauge, Rocket, User, Key, LogOut, Eye, EyeOff
} from 'lucide-react'
import { toast } from 'sonner'
import { useThemeStore, Theme } from '@/stores/themeStore'
import { systemApi, SystemConfig } from '@/api/system'
import { api } from '@/api/client'
import { authApi, AuthConfig, clearAuth } from '@/api/auth'

type TabType = 'appearance' | 'network' | 'auth' | 'system' | 'about'

interface ProxyConfig {
  mixedPort: number
  socksPort: number
  redirPort: number
  tproxyPort: number
  allowLan: boolean
  ipv6: boolean
}

export default function SettingsPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { theme, setTheme } = useThemeStore()
  const [activeTab, setActiveTab] = useState<TabType>('appearance')
  const [sysConfig, setSysConfig] = useState<SystemConfig | null>(null)
  const [proxyConfig, setProxyConfig] = useState<ProxyConfig>({
    mixedPort: 7890,
    socksPort: 7891,
    redirPort: 7892,
    tproxyPort: 7893,
    allowLan: true,
    ipv6: false,
  })
  const [authConfig, setAuthConfig] = useState<AuthConfig | null>(null)
  const [loading, setLoading] = useState(true)
  // 认证设置状态
  const [newUsername, setNewUsername] = useState('')
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showOldPassword, setShowOldPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)

  useEffect(() => {
    loadSysConfig()
    loadProxyConfig()
    loadAuthConfig()
  }, [])

  const loadAuthConfig = async () => {
    try {
      const data = await authApi.getConfig()
      setAuthConfig(data)
      setNewUsername(data.username)
    } catch (e) {
      console.error('Load auth config error:', e)
    }
  }

  const loadProxyConfig = async () => {
    try {
      const data = await api.get<ProxyConfig>('/proxy/config')
      setProxyConfig(data)
    } catch (e) {
      console.error('Load proxy config error:', e)
    }
  }

  const updateProxyConfig = async (key: keyof ProxyConfig, value: number | boolean) => {
    try {
      await api.put('/proxy/config', { [key]: value })
      setProxyConfig(prev => ({ ...prev, [key]: value }))
      toast.success('设置已保存')
    } catch (e: any) {
      toast.error(e.message || '保存失败')
    }
  }

  const loadSysConfig = async () => {
    try {
      const data = await systemApi.getConfig()
      setSysConfig(data)
    } catch {
      // 非 Linux 系统可能不支持
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = async (key: keyof SystemConfig, setter: (enabled: boolean) => Promise<any>) => {
    if (!sysConfig) return
    const newValue = !sysConfig[key]
    try {
      await setter(newValue)
      setSysConfig({ ...sysConfig, [key]: newValue })
      toast.success(newValue ? '已开启' : '已关闭')
    } catch (e: any) {
      toast.error(e.message || '操作失败，需要 root 权限')
    }
  }

  const handleOptimizeAll = async () => {
    try {
      await systemApi.optimizeAll()
      await loadSysConfig()
      toast.success('已开启所有优化')
    } catch (e: any) {
      toast.error(e.message || '操作失败，需要 root 权限')
    }
  }

  const handleAuthToggle = async (enabled: boolean) => {
    try {
      await authApi.setEnabled(enabled)
      setAuthConfig(prev => prev ? { ...prev, enabled } : null)
      toast.success(t('auth.saveSuccess'))
    } catch (e: any) {
      toast.error(e.message || t('auth.saveFailed'))
    }
  }

  const handleUpdateUsername = async () => {
    if (!newUsername.trim()) return
    try {
      await authApi.updateUsername(newUsername)
      setAuthConfig(prev => prev ? { ...prev, username: newUsername } : null)
      toast.success(t('auth.saveSuccess'))
    } catch (e: any) {
      toast.error(e.message || t('auth.saveFailed'))
    }
  }

  const handleUpdatePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error(t('auth.passwordMismatch'))
      return
    }
    if (newPassword.length < 6) {
      toast.error(t('auth.passwordTooShort'))
      return
    }
    try {
      await authApi.updatePassword(oldPassword, newPassword)
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
      toast.success(t('auth.saveSuccess'))
    } catch (e: any) {
      toast.error(e.message || t('auth.saveFailed'))
    }
  }

  const handleLogout = async () => {
    try {
      await authApi.logout()
      clearAuth()
      navigate('/login')
    } catch {
      clearAuth()
      navigate('/login')
    }
  }

  const tabs = [
    { id: 'appearance' as TabType, label: '外观', icon: Palette },
    { id: 'network' as TabType, label: '网络', icon: Network },
    { id: 'auth' as TabType, label: '认证', icon: Shield },
    { id: 'system' as TabType, label: '系统', icon: Server },
    { id: 'about' as TabType, label: '关于', icon: Info },
  ]

  return (
    <div className="space-y-3 lg:space-y-4">
      {/* 顶部标签栏 */}
      <div className="flex gap-1 lg:gap-2 overflow-x-auto pb-1">
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1 lg:gap-2 px-3 lg:px-4 py-1.5 lg:py-2 rounded-lg text-xs lg:text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* 内容区 */}
      <div className="max-w-2xl">
        {/* 外观设置 */}
        {activeTab === 'appearance' && (
          <div className="space-y-6">
            <SectionCard 
              icon={Palette} 
              title="主题设置" 
              description="自定义应用程序的外观"
            >
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: 'light' as Theme, icon: Sun, label: '浅色' },
                  { value: 'dark' as Theme, icon: Moon, label: '深色' },
                  { value: 'system' as Theme, icon: Monitor, label: '跟随系统' },
                ].map((item) => {
                  const Icon = item.icon
                  return (
                    <button
                      key={item.value}
                      onClick={() => setTheme(item.value)}
                      className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                        theme === item.value
                          ? 'border-primary bg-primary/5'
                          : 'border-transparent bg-muted/50 hover:bg-muted'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        theme === item.value ? 'bg-primary text-primary-foreground' : 'bg-muted-foreground/20'
                      }`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className={`text-sm font-medium ${
                        theme === item.value ? 'text-primary' : ''
                      }`}>{item.label}</span>
                    </button>
                  )
                })}
              </div>
            </SectionCard>

            <SectionCard 
              icon={Globe} 
              title="语言设置" 
              description="选择界面显示语言"
            >
              <div className="grid grid-cols-2 gap-3">
                {[
                  { code: 'zh', label: '中文', flag: '🇨🇳' },
                  { code: 'en', label: 'English', flag: '🇺🇸' },
                ].map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => i18n.changeLanguage(lang.code)}
                    className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                      i18n.language === lang.code
                        ? 'border-primary bg-primary/5'
                        : 'border-transparent bg-muted/50 hover:bg-muted'
                    }`}
                  >
                    <span className="text-2xl">{lang.flag}</span>
                    <span className={`font-medium ${
                      i18n.language === lang.code ? 'text-primary' : ''
                    }`}>{lang.label}</span>
                  </button>
                ))}
              </div>
            </SectionCard>
          </div>
        )}

        {/* 网络设置 */}
        {activeTab === 'network' && (
          <div className="space-y-6">
            <SectionCard 
              icon={Network} 
              title="代理端口" 
              description="配置代理服务监听端口"
            >
              <div className="space-y-4">
                <SettingItem label="混合端口" desc="HTTP/SOCKS5 代理">
                  <input
                    type="number"
                    value={proxyConfig.mixedPort}
                    onChange={(e) => updateProxyConfig('mixedPort', Number(e.target.value))}
                    className="w-24 px-3 py-2 rounded-lg border border-border bg-background text-right font-mono"
                  />
                </SettingItem>
                <SettingItem label="SOCKS 端口" desc="SOCKS5 代理">
                  <input
                    type="number"
                    value={proxyConfig.socksPort}
                    onChange={(e) => updateProxyConfig('socksPort', Number(e.target.value))}
                    className="w-24 px-3 py-2 rounded-lg border border-border bg-background text-right font-mono"
                  />
                </SettingItem>
                <SettingItem label="Redir 端口" desc="透明代理重定向">
                  <input
                    type="number"
                    value={proxyConfig.redirPort}
                    onChange={(e) => updateProxyConfig('redirPort', Number(e.target.value))}
                    className="w-24 px-3 py-2 rounded-lg border border-border bg-background text-right font-mono"
                  />
                </SettingItem>
                <SettingItem label="TProxy 端口" desc="TPROXY 透明代理">
                  <input
                    type="number"
                    value={proxyConfig.tproxyPort}
                    onChange={(e) => updateProxyConfig('tproxyPort', Number(e.target.value))}
                    className="w-24 px-3 py-2 rounded-lg border border-border bg-background text-right font-mono"
                  />
                </SettingItem>
              </div>
            </SectionCard>

            <SectionCard 
              icon={Shield} 
              title="网络选项" 
              description="其他网络相关设置"
            >
              <div className="space-y-4">
                <SettingItem label="允许局域网" desc="允许其他设备连接" icon={Network}>
                  <ToggleSwitch 
                    checked={proxyConfig.allowLan} 
                    onChange={() => updateProxyConfig('allowLan', !proxyConfig.allowLan)}
                  />
                </SettingItem>
                <SettingItem label="IPv6 支持" desc="启用 IPv6 网络" icon={Globe}>
                  <ToggleSwitch 
                    checked={proxyConfig.ipv6}
                    onChange={() => updateProxyConfig('ipv6', !proxyConfig.ipv6)}
                  />
                </SettingItem>
              </div>
            </SectionCard>
          </div>
        )}

        {/* 认证设置 */}
        {activeTab === 'auth' && (
          <div className="space-y-6">
            <SectionCard 
              icon={Shield} 
              title={t('auth.authSettings')} 
              description={t('auth.enableAuthDesc')}
            >
              <div className="space-y-4">
                <SettingItem label={t('auth.enableAuth')} desc={t('auth.enableAuthDesc')} icon={Shield}>
                  <ToggleSwitch 
                    checked={authConfig?.enabled || false} 
                    onChange={() => handleAuthToggle(!authConfig?.enabled)}
                  />
                </SettingItem>
              </div>
            </SectionCard>

            <SectionCard 
              icon={User} 
              title={t('auth.changeUsername')} 
              description={t('auth.currentUsername') + ': ' + (authConfig?.username || 'admin')}
            >
              <div className="space-y-4">
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    className="flex-1 px-4 py-2 rounded-lg border border-border bg-background"
                    placeholder={t('auth.newUsername')}
                  />
                  <button
                    onClick={handleUpdateUsername}
                    className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    {t('common.save')}
                  </button>
                </div>
              </div>
            </SectionCard>

            <SectionCard 
              icon={Key} 
              title={t('auth.changePassword')} 
              description=""
            >
              <div className="space-y-4">
                <div className="relative">
                  <input
                    type={showOldPassword ? 'text' : 'password'}
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg border border-border bg-background pr-10"
                    placeholder={t('auth.oldPassword')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowOldPassword(!showOldPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showOldPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg border border-border bg-background pr-10"
                    placeholder={t('auth.newPassword')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-border bg-background"
                  placeholder={t('auth.confirmPassword')}
                />
                <button
                  onClick={handleUpdatePassword}
                  className="w-full py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {t('auth.changePassword')}
                </button>
              </div>
            </SectionCard>

            {authConfig?.enabled && (
              <button
                onClick={handleLogout}
                className="w-full py-3 rounded-lg border border-destructive text-destructive hover:bg-destructive/10 flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                {t('auth.logout')}
              </button>
            )}
          </div>
        )}

        {/* 系统设置 */}
        {activeTab === 'system' && (
          <div className="space-y-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : sysConfig ? (
              <>
                <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                      <Rocket className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <div className="font-semibold">一键优化</div>
                      <div className="text-sm text-muted-foreground">开启所有推荐的系统优化</div>
                    </div>
                  </div>
                  <button
                    onClick={handleOptimizeAll}
                    className="inline-flex items-center px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
                  >
                    <Zap className="w-4 h-4 mr-2" />
                    立即优化
                  </button>
                </div>

                <SectionCard 
                  icon={Power} 
                  title="服务管理" 
                  description="控制 P-BOX 服务行为"
                >
                  <SettingItem 
                    label="开机自启" 
                    desc="使用 systemd 管理，开机自动运行" 
                    icon={Power}
                  >
                    <ToggleSwitch 
                      checked={sysConfig.autoStart} 
                      onChange={() => handleToggle('autoStart', systemApi.setAutoStart)} 
                    />
                  </SettingItem>
                </SectionCard>

                <SectionCard 
                  icon={Cpu} 
                  title="内核优化" 
                  description="Linux 系统内核参数调优"
                >
                  <div className="space-y-4">
                    <SettingItem 
                      label="IP 转发" 
                      desc="作为网关必须开启 (net.ipv4.ip_forward)" 
                      icon={ArrowUpDown}
                    >
                      <ToggleSwitch 
                        checked={sysConfig.ipForward} 
                        onChange={() => handleToggle('ipForward', systemApi.setIPForward)} 
                      />
                    </SettingItem>
                    <SettingItem 
                      label="BBR 拥塞控制" 
                      desc="Google BBR 算法，提升吞吐量" 
                      icon={Gauge}
                    >
                      <ToggleSwitch 
                        checked={sysConfig.bbrEnabled} 
                        onChange={() => handleToggle('bbrEnabled', systemApi.setBBR)} 
                      />
                    </SettingItem>
                    <SettingItem 
                      label="TUN 网络优化" 
                      desc="TCP Fast Open、缓冲区优化" 
                      icon={Rocket}
                    >
                      <ToggleSwitch 
                        checked={sysConfig.tunOptimized} 
                        onChange={() => handleToggle('tunOptimized', systemApi.setTUNOptimize)} 
                      />
                    </SettingItem>
                  </div>
                </SectionCard>

                <p className="text-xs text-muted-foreground text-center">
                  * 以上设置需要 root 权限，配置将持久化到 /etc/sysctl.d/99-p-box.conf
                </p>
              </>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Server className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>系统优化功能仅在 Linux 系统可用</p>
              </div>
            )}
          </div>
        )}

        {/* 关于 */}
        {activeTab === 'about' && (
          <div className="space-y-6">
            <div className="text-center py-8">
              <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg">
                <span className="text-4xl">📦</span>
              </div>
              <h2 className="text-2xl font-bold mb-1">P-BOX</h2>
              <p className="text-muted-foreground">Linux 透明代理网关</p>
            </div>

            <SectionCard icon={Info} title="版本信息">
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">应用版本</span>
                  <span className="font-mono font-medium">v0.1.0</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">代理核心</span>
                  <span className="font-mono font-medium">Mihomo</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">构建时间</span>
                  <span className="font-mono font-medium">2025-12-06</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-muted-foreground">开源协议</span>
                  <span className="font-mono font-medium">MIT License</span>
                </div>
              </div>
            </SectionCard>

            <div className="text-center text-sm text-muted-foreground">
              Made with ❤️ for Linux Gateway
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// 分区卡片组件
function SectionCard({ 
  icon: Icon, 
  title, 
  description, 
  children 
}: { 
  icon: any
  title: string
  description?: string
  children: React.ReactNode 
}) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-muted/30">
        <Icon className="w-5 h-5 text-primary" />
        <div>
          <h3 className="font-semibold">{title}</h3>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

// 设置项组件
function SettingItem({ 
  label, 
  desc, 
  icon: Icon, 
  children 
}: { 
  label: string
  desc?: string
  icon?: any
  children: React.ReactNode 
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
            <Icon className="w-4 h-4 text-muted-foreground" />
          </div>
        )}
        <div>
          <div className="font-medium">{label}</div>
          {desc && <div className="text-sm text-muted-foreground">{desc}</div>}
        </div>
      </div>
      {children}
    </div>
  )
}

// 开关组件
function ToggleSwitch({ checked, onChange }: { checked?: boolean; onChange?: () => void }) {
  return (
    <button 
      onClick={onChange}
      className={`relative w-12 h-7 rounded-full transition-colors ${
        checked ? 'bg-primary' : 'bg-muted'
      }`}
    >
      <span className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-md transition-transform ${
        checked ? 'left-6' : 'left-1'
      }`} />
    </button>
  )
}
