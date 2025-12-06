import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Play,
  Square,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  Clock,
  Cpu,
  Activity,
  Zap,
  ChevronRight,
  Loader2,
} from 'lucide-react'
import { api } from '@/api/client'
import { mihomoApi } from '@/api/mihomo'

type TransparentMode = 'off' | 'tun' | 'tproxy' | 'redirect'

interface ProxyStatus {
  running: boolean
  coreType: string
  coreVersion: string
  mode: string
  mixedPort: number
  socksPort: number
  allowLan: boolean
  tunEnabled: boolean
  transparentMode: TransparentMode
  uptime: number
  configPath: string
  apiAddress: string
}

export default function DashboardPage() {
  const { t } = useTranslation()
  const [status, setStatus] = useState<ProxyStatus>({
    running: false,
    coreType: 'mihomo',
    coreVersion: '',
    mode: 'rule',
    mixedPort: 7890,
    socksPort: 7891,
    allowLan: true,
    tunEnabled: true,
    transparentMode: 'tun', // 默认 TUN 模式
    uptime: 0,
    configPath: '',
    apiAddress: '',
  })
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [traffic, setTraffic] = useState({ upload: 0, download: 0, connections: 0 })
  const [displayUptime, setDisplayUptime] = useState(0)
  const [autoStart, setAutoStart] = useState(false)
  const [autoStartDelay, setAutoStartDelay] = useState(15)
  const initializedRef = useRef(false)
  const uptimeBaseRef = useRef(0)
  const startTimeRef = useRef(0)
  const wsRef = useRef<WebSocket | null>(null)

  // 加载状态
  const loadStatus = async () => {
    try {
      const data = await api.get<ProxyStatus>('/proxy/status')
      setStatus(data)
      // 记录基准时间并立即更新显示
      if (data.running && data.uptime > 0) {
        uptimeBaseRef.current = data.uptime
        startTimeRef.current = Date.now()
        setDisplayUptime(data.uptime) // 立即显示当前 uptime
      } else if (!data.running) {
        setDisplayUptime(0)
      }
    } catch (e) {
      console.error('Load status error:', e)
    }
  }

  // 加载代理配置（包含自动启动设置）
  const loadConfig = async () => {
    try {
      const data = await api.get<{ autoStart: boolean; autoStartDelay: number }>('/proxy/config')
      setAutoStart(data.autoStart || false)
      setAutoStartDelay(data.autoStartDelay || 15)
    } catch (e) {
      console.error('Load config error:', e)
    }
  }

  // 更新自动启动设置
  const updateAutoStart = async (enabled: boolean, delay?: number) => {
    try {
      await api.put('/proxy/config', {
        autoStart: enabled,
        autoStartDelay: delay ?? autoStartDelay,
      })
      setAutoStart(enabled)
      if (delay !== undefined) setAutoStartDelay(delay)
      toast.success(enabled ? '已开启自动启动' : '已关闭自动启动')
    } catch (e: any) {
      toast.error(e.message || '设置失败')
    }
  }

  // 初始化
  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true
    loadStatus()
    loadConfig()
  }, [])

  // 定时刷新状态（每 10 秒）
  useEffect(() => {
    const timer = setInterval(() => {
      loadStatus()
    }, 10000)
    return () => clearInterval(timer)
  }, [])

  // 实时更新运行时间（每秒）
  useEffect(() => {
    if (!status.running) {
      setDisplayUptime(0)
      return
    }

    const timer = setInterval(() => {
      // 确保 startTimeRef 已初始化
      if (startTimeRef.current > 0) {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000)
        setDisplayUptime(uptimeBaseRef.current + elapsed)
      }
    }, 1000)

    return () => clearInterval(timer)
  }, [status.running])

  // WebSocket 实时流量 (通过后端代理)
  useEffect(() => {
    if (!status.running) {
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
      setTraffic({ upload: 0, download: 0, connections: 0 })
      return
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host // 包含端口
    const ws = new WebSocket(`${protocol}//${host}/ws/traffic`)
    wsRef.current = ws

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        setTraffic(prev => ({
          ...prev,
          upload: data.up || 0,
          download: data.down || 0,
        }))
      } catch {}
    }

    ws.onerror = (e) => {
      console.error('Traffic WebSocket error:', e)
    }

    ws.onopen = () => {
      console.log('Traffic WebSocket connected')
    }

    ws.onclose = (e) => {
      console.log('Traffic WebSocket closed:', e.code, e.reason)
    }

    return () => {
      ws.close()
      wsRef.current = null
    }
  }, [status.running])

  // 获取连接数 (通过后端 WebSocket 代理)
  useEffect(() => {
    if (!status.running) return

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    const ws = new WebSocket(`${protocol}//${host}/ws/connections`)

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        setTraffic(prev => ({
          ...prev,
          connections: data.connections?.length || 0,
        }))
      } catch {}
    }

    ws.onerror = (e) => {
      console.error('Connections WebSocket error:', e)
    }

    return () => {
      ws.close()
    }
  }, [status.running])

  // 生成配置并启动
  const handleGenerateAndStart = async () => {
    setGenerating(true)
    try {
      // 获取所有节点
      const nodes = await api.get<any[]>('/nodes')
      if (!nodes || nodes.length === 0) {
        toast.error('没有可用节点，请先添加订阅或导入节点')
        return
      }

      // 生成配置
      await api.post('/proxy/generate', { nodes })
      toast.success('配置生成成功')

      // 启动代理
      await handleStart()
    } catch (e: any) {
      toast.error(e.message || '生成配置失败')
    } finally {
      setGenerating(false)
    }
  }

  const handleStart = async () => {
    setLoading(true)
    try {
      await api.post('/proxy/start', {})
      toast.success('代理已启动')
      await loadStatus()
    } catch (e: any) {
      toast.error(e.message || '启动失败')
    } finally {
      setLoading(false)
    }
  }

  const handleStop = async () => {
    setLoading(true)
    try {
      await api.post('/proxy/stop', {})
      toast.success('代理已停止')
      await loadStatus()
    } catch (e: any) {
      toast.error(e.message || '停止失败')
    } finally {
      setLoading(false)
    }
  }

  const handleRestart = async () => {
    setLoading(true)
    try {
      await api.post('/proxy/restart', {})
      toast.success('代理已重启')
      await loadStatus()
    } catch (e: any) {
      toast.error(e.message || '重启失败')
    } finally {
      setLoading(false)
    }
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    if (h > 0) return `${h}h ${m}m`
    if (m > 0) return `${m}m ${s}s`
    return `${s}s`
  }

  // 切换模式
  const handleModeChange = async (mode: string) => {
    // 保存到本地配置
    try {
      await api.put('/proxy/config', { mode })
      setStatus(prev => ({ ...prev, mode }))
      
      // 如果正在运行，同时更新 Mihomo
      if (status.running) {
        await mihomoApi.patchConfigs({ mode: mode as any })
      }
      
      toast.success(`已切换到${mode === 'rule' ? '规则' : mode === 'global' ? '全局' : '直连'}模式`)
    } catch (e: any) {
      toast.error(e.message || '切换失败')
    }
  }

  // 切换透明代理模式
  const handleTransparentModeChange = async (mode: TransparentMode) => {
    try {
      await api.put('/proxy/transparent', { mode })
      setStatus(prev => ({ 
        ...prev, 
        transparentMode: mode,
        tunEnabled: mode === 'tun'
      }))
      const modeNames: Record<TransparentMode, string> = {
        off: '已关闭透明代理',
        tun: 'TUN 模式已开启，需要重新生成配置',
        tproxy: 'TPROXY 模式已开启，需配置 iptables',
        redirect: 'REDIRECT 模式已开启，需配置 iptables',
      }
      toast.success(modeNames[mode])
    } catch (e: any) {
      toast.error(e.message || '切换失败')
    }
  }

  // 透明代理模式选项
  const transparentModes: { key: TransparentMode; label: string; desc: string }[] = [
    { key: 'off', label: '关闭', desc: '仅 HTTP/SOCKS 代理' },
    { key: 'tun', label: 'TUN', desc: '虚拟网卡 (推荐)' },
    { key: 'tproxy', label: 'TPROXY', desc: 'iptables 透明代理' },
    { key: 'redirect', label: 'REDIRECT', desc: 'iptables 重定向' },
  ]

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* 模式切换 */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        {/* 透明代理模式 */}
        <div className="flex items-center gap-2">
          <span className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">透明代理</span>
          <div className="flex rounded-lg border border-border overflow-hidden bg-card">
            {transparentModes.map((m) => (
              <button
                key={m.key}
                onClick={() => handleTransparentModeChange(m.key)}
                className={`px-2 sm:px-3 py-1 sm:py-1.5 text-xs font-medium transition-colors ${
                  status.transparentMode === m.key
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted'
                }`}
                title={m.desc}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* 代理模式切换 */}
        <div className="flex items-center gap-2">
          <span className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">代理模式</span>
          <div className="flex rounded-lg border border-border overflow-hidden bg-card">
            {[
              { key: 'rule', label: '规则', desc: '智能分流' },
              { key: 'global', label: '全局', desc: '全部代理' },
              { key: 'direct', label: '直连', desc: '不走代理' },
            ].map((m) => (
              <button
                key={m.key}
                onClick={() => handleModeChange(m.key)}
                className={`px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium transition-colors ${
                  status.mode === m.key
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted'
                }`}
                title={m.desc}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 主控制卡片 */}
      <div className="rounded-xl border border-border bg-card p-4 lg:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center ${
                status.running
                  ? 'bg-success/10 text-success'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">
                {t('dashboard.proxyService')}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    status.running
                      ? 'bg-success/10 text-success'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                      status.running ? 'bg-success animate-pulse' : 'bg-muted-foreground'
                    }`}
                  />
                  {status.running ? t('dashboard.running') : t('dashboard.stopped')}
                </span>
                <span className="text-sm text-muted-foreground">
                  {status.coreType}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {status.running ? (
              <>
                <button
                  onClick={handleStop}
                  disabled={loading}
                  className="inline-flex items-center px-4 py-2 rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Square className="w-4 h-4 mr-2" />}
                  {t('dashboard.stop')}
                </button>
                <button 
                  onClick={handleRestart}
                  disabled={loading}
                  className="p-2 rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
                  title="重启"
                >
                  <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleGenerateAndStart}
                  disabled={loading || generating}
                  className="inline-flex items-center px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {(loading || generating) ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
                  {generating ? '生成配置中...' : t('dashboard.start')}
                </button>
                <button 
                  onClick={loadStatus}
                  className="p-2 rounded-lg hover:bg-muted transition-colors"
                  title="刷新状态"
                >
                  <RefreshCw className="w-5 h-5" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* 自动启动设置 */}
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">开机自动启动</span>
              <button
                onClick={() => updateAutoStart(!autoStart)}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  autoStart ? 'bg-primary' : 'bg-muted'
                }`}
              >
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-md transition-transform ${
                  autoStart ? 'left-6' : 'left-1'
                }`} />
              </button>
            </div>
            {autoStart && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">延迟</span>
                <select
                  value={autoStartDelay}
                  onChange={(e) => updateAutoStart(true, Number(e.target.value))}
                  className="px-2 py-1 text-sm rounded-lg border border-border bg-background"
                >
                  <option value={0}>0 秒</option>
                  <option value={5}>5 秒</option>
                  <option value={10}>10 秒</option>
                  <option value={15}>15 秒</option>
                  <option value={30}>30 秒</option>
                  <option value={60}>60 秒</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {/* 代理信息 */}
        {status.running && (
          <div className="mt-4 pt-4 border-t border-border">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">HTTP 端口</span>
                <p className="font-mono font-medium">{status.mixedPort}</p>
              </div>
              <div>
                <span className="text-muted-foreground">SOCKS 端口</span>
                <p className="font-mono font-medium">{status.socksPort || status.mixedPort}</p>
              </div>
              <div>
                <span className="text-muted-foreground">局域网</span>
                <p className="font-medium">{status.allowLan ? '允许' : '禁止'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">API</span>
                <p className="font-mono font-medium text-xs">{status.apiAddress || '-'}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={ArrowUp}
          label={t('dashboard.upload')}
          value={formatBytes(traffic.upload) + '/s'}
          color="text-success"
        />
        <StatCard
          icon={ArrowDown}
          label={t('dashboard.download')}
          value={formatBytes(traffic.download) + '/s'}
          color="text-primary"
        />
        <StatCard
          icon={Clock}
          label={t('dashboard.uptime')}
          value={status.running ? formatDuration(displayUptime) : '-'}
          color="text-warning"
        />
        <StatCard
          icon={Activity}
          label={t('dashboard.connections')}
          value={status.running ? traffic.connections.toString() : '0'}
          color="text-destructive"
        />
      </div>

      {/* 核心信息卡片 */}
      <Link
        to="/core-manage"
        className="block rounded-xl border border-border bg-card p-5 hover:border-primary/50 transition-colors group"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
              <Cpu className="w-6 h-6 text-primary" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground">{t('dashboard.coreType')}</div>
              <div className="font-semibold text-lg">
                {status.coreType === 'mihomo' ? 'Mihomo' : 'sing-box'}
                <span className="text-sm text-muted-foreground font-normal ml-2">
                  {status.coreVersion}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground group-hover:text-primary transition-colors">
            <span className="text-sm">{t('core.title')}</span>
            <ChevronRight className="w-5 h-5" />
          </div>
        </div>
      </Link>

    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof ArrowUp
  label: string
  value: string
  color: string
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  )
}
