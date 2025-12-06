import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { 
  Gauge, Play, Tv, RotateCcw, Zap, 
  Download, Upload,
  Globe, ChevronDown
} from 'lucide-react'
import { CyberpunkSpeedometer } from '@/components/speedtest/CyberpunkSpeedometer'
import * as speedTestService from '@/services/speedTestService'
import { mediaIconMap, mediaServices } from '@/components/media/MediaIcons'

type SpeedTestResult = speedTestService.SpeedTestResult

// 测速源配置
const speedTestSources = [
  { id: 'fastcom', name: 'Netflix Fast.com', color: 'text-red-400' },
  { id: 'cloudflare', name: 'Cloudflare CDN', color: 'text-orange-400' },
]

// 线程数选项
const threadOptions = [10, 50, 100, 200]

type TabType = 'speedtest' | 'media'

export default function ToolsPage() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<TabType>('speedtest')

  const tabs = [
    { id: 'speedtest' as TabType, label: t('tools.speedtest'), icon: Gauge },
    { id: 'media' as TabType, label: t('tools.mediaTest'), icon: Tv },
  ]

  return (
    <div className="space-y-3 lg:space-y-4">
      {/* 顶部标签栏 */}
      <div className="flex gap-1 lg:gap-2">
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1 lg:gap-2 px-3 lg:px-4 py-1.5 lg:py-2 rounded-lg text-xs lg:text-sm font-medium transition-all ${
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
      <div>
        {activeTab === 'speedtest' && <SpeedTestTab />}
        {activeTab === 'media' && <MediaTestTab />}
      </div>
    </div>
  )
}

// 网络测速 Tab（使用 WebSocket 实时推送）
function SpeedTestTab() {
  const { t } = useTranslation()
  const [isRunning, setIsRunning] = useState(false)
  const [currentSpeed, setCurrentSpeed] = useState(0)
  const [ping, setPing] = useState(0)
  const [downloadSpeed, setDownloadSpeed] = useState(0)
  const [uploadSpeed, setUploadSpeed] = useState(0)
  const [testPhase, setTestPhase] = useState<'idle' | 'ping' | 'download' | 'upload' | 'complete'>('idle')
  const [results, setResults] = useState<SpeedTestResult[]>([])
  const [stopFn, setStopFn] = useState<(() => void) | null>(null)
  
  // 测速设置
  const [selectedSource, setSelectedSource] = useState('cloudflare')
  const [downloadThreads, setDownloadThreads] = useState(10)
  const [uploadThreads, setUploadThreads] = useState(3)

  // 加载历史记录
  useEffect(() => {
    loadHistory()
  }, [])

  const loadHistory = async () => {
    try {
      const history = await speedTestService.getSpeedTestHistory()
      setResults(history || [])
    } catch (error) {
      console.error('加载历史记录失败:', error)
    }
  }

  // 删除单条历史
  const handleDeleteHistory = async (id: number) => {
    try {
      await speedTestService.deleteSpeedTestHistory(id)
      setResults(prev => prev.filter(r => r.id !== id))
      toast.success(t('common.success'))
    } catch {
      toast.error(t('common.error'))
    }
  }

  // 清空历史
  const handleClearHistory = async () => {
    if (!confirm(t('tools.clearHistory') + '?')) return
    try {
      await speedTestService.clearSpeedTestHistory()
      setResults([])
      toast.success(t('common.success'))
    } catch {
      toast.error(t('common.error'))
    }
  }

  const startSpeedTest = () => {
    setIsRunning(true)
    setCurrentSpeed(0)
    setPing(0)
    setDownloadSpeed(0)
    setUploadSpeed(0)
    setTestPhase('ping')
    
    const sourceName = speedTestSources.find(s => s.id === selectedSource)?.name || 'Cloudflare'
    toast.info(`${sourceName} ${t('tools.testing')}`)
    
    // 使用 WebSocket 实时测速
    const { stop } = speedTestService.runSpeedTestWithProgress(
      selectedSource,
      downloadThreads,
      uploadThreads,
      (progress) => {
        if (progress.type === 'progress') {
          // 更新当前阶段
          if (progress.phase) {
            setTestPhase(progress.phase)
          }
          // 更新速度值
          if (progress.phase === 'ping' && progress.value) {
            setPing(Math.round(progress.value))
          } else if (progress.phase === 'download' && progress.value) {
            setDownloadSpeed(Math.round(progress.value))
            setCurrentSpeed(Math.round(progress.value))
          } else if (progress.phase === 'upload' && progress.value) {
            setUploadSpeed(Math.round(progress.value))
            setCurrentSpeed(Math.round(progress.value))
          }
        } else if (progress.type === 'complete') {
          setTestPhase('complete')
          setIsRunning(false)
          setStopFn(null)
          loadHistory()
          if (progress.result) {
            toast.success(`${t('tools.speedTestComplete')} - ${progress.result.downloadSpeed.toFixed(1)} Mbps`)
          }
        } else if (progress.type === 'error') {
          setTestPhase('idle')
          setIsRunning(false)
          setStopFn(null)
          toast.error(progress.message || t('tools.speedTestFailed'))
        }
      }
    )
    
    setStopFn(() => stop)
  }

  const stopSpeedTest = () => {
    if (stopFn) {
      stopFn()
      setIsRunning(false)
      setTestPhase('idle')
      setStopFn(null)
      toast.info(t('tools.stop'))
    }
  }

  const resetTest = () => {
    setCurrentSpeed(0)
    setPing(0)
    setDownloadSpeed(0)
    setUploadSpeed(0)
    setTestPhase('idle')
  }

  const getPhaseText = () => {
    switch (testPhase) {
      case 'ping': return t('tools.ping') + '...'
      case 'download': return t('tools.downloadSpeed') + '...'
      case 'upload': return t('tools.uploadSpeed') + '...'
      case 'complete': return t('tools.complete')
      default: return t('tools.ready')
    }
  }

  const getPhaseIcon = () => {
    switch (testPhase) {
      case 'ping':
      case 'download':
      case 'upload':
        return <Gauge className="w-4 h-4 animate-spin" />
      case 'complete': return <Zap className="w-4 h-4" />
      default: return <Play className="w-4 h-4" />
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* 左侧：测速仪表盘 */}
      <div className="lg:col-span-2">
        <div className="rounded-xl border border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-pink-500/5 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {getPhaseIcon()}
              <span className="font-medium text-sm">{getPhaseText()}</span>
            </div>
            {testPhase !== 'idle' && (
              <span className={`px-2 py-0.5 rounded text-xs ${
                testPhase === 'complete'
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-purple-500/20 text-purple-400 animate-pulse'
              }`}>
                {testPhase === 'complete' ? t('tools.completed') : t('tools.testing')}
              </span>
            )}
          </div>

          {/* 赛博朋克仪表盘 */}
          <CyberpunkSpeedometer
            speed={currentSpeed}
            maxSpeed={500}
            ping={ping}
            downloadSpeed={downloadSpeed}
            uploadSpeed={uploadSpeed}
            isRunning={isRunning}
          />

          {/* 测速设置 */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-3 mb-3">
            {/* 测速源选择 */}
            <div className="flex items-center gap-1.5 bg-purple-500/10 rounded-lg px-2.5 py-1.5 border border-purple-500/20">
              <Globe className="w-3.5 h-3.5 text-purple-400" />
              <div className="relative">
                <select
                  value={selectedSource}
                  onChange={(e) => {
                    setSelectedSource(e.target.value)
                    if (e.target.value === 'fastcom') setDownloadThreads(100)
                    else setDownloadThreads(10)
                  }}
                  disabled={isRunning}
                  className="appearance-none text-xs bg-transparent pr-5 focus:outline-none disabled:opacity-50 cursor-pointer font-medium"
                >
                  {speedTestSources.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 text-purple-400 pointer-events-none" />
              </div>
            </div>

            {/* 下载线程数 */}
            <div className="flex items-center gap-1.5 bg-green-500/10 rounded-lg px-2.5 py-1.5 border border-green-500/20">
              <Download className="w-3.5 h-3.5 text-green-400" />
              <div className="relative">
                <select
                  value={downloadThreads}
                  onChange={(e) => setDownloadThreads(Number(e.target.value))}
                  disabled={isRunning}
                  className="appearance-none text-xs bg-transparent pr-5 focus:outline-none disabled:opacity-50 cursor-pointer font-medium"
                >
                  {threadOptions.map(num => (
                    <option key={num} value={num}>{num} {t('tools.threads')}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 text-green-400 pointer-events-none" />
              </div>
            </div>

            {/* 上传线程数 */}
            <div className="flex items-center gap-1.5 bg-blue-500/10 rounded-lg px-2.5 py-1.5 border border-blue-500/20">
              <Upload className="w-3.5 h-3.5 text-blue-400" />
              <div className="relative">
                <select
                  value={uploadThreads}
                  onChange={(e) => setUploadThreads(Number(e.target.value))}
                  disabled={isRunning}
                  className="appearance-none text-xs bg-transparent pr-5 focus:outline-none disabled:opacity-50 cursor-pointer font-medium"
                >
                  {[1, 3, 5, 10].map(num => (
                    <option key={num} value={num}>{num} {t('tools.threads')}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 text-blue-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* 控制按钮 */}
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={startSpeedTest}
              disabled={isRunning}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-medium hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 transition-all shadow-lg shadow-purple-500/30"
            >
              <Play className="w-4 h-4" />
              {t('tools.startSpeedTest')}
            </button>
            {isRunning && (
              <button
                onClick={stopSpeedTest}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-500/30 text-red-400 text-sm hover:bg-red-500/10 transition-colors"
              >
                {t('tools.stop')}
              </button>
            )}
            <button
              onClick={resetTest}
              disabled={isRunning}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-blue-500/30 text-blue-400 text-sm hover:bg-blue-500/10 disabled:opacity-50 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              {t('tools.reset')}
            </button>
          </div>
        </div>
      </div>

      {/* 右侧：测速历史 */}
      <div className="space-y-4">
        {/* 测速历史 */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium">{t('tools.speedTestHistory')}</h3>
            {results.length > 0 && (
              <button
                onClick={handleClearHistory}
                className="text-xs text-red-400 hover:text-red-300"
              >
                {t('tools.clearHistory')}
              </button>
            )}
          </div>
          {results.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">{t('tools.noHistory')}</p>
          ) : (
            <div className="space-y-2">
              {results.map((result) => (
                <div key={result.id} className="p-3 rounded-lg border bg-muted/30 group relative">
                  <button
                    onClick={() => handleDeleteHistory(result.id)}
                    className="absolute top-2 right-2 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                  >
                    ✕
                  </button>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted-foreground">
                      {new Date(result.timestamp).toLocaleString('zh-CN')}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded bg-muted">{result.threads}线程</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <div className="text-muted-foreground">下载</div>
                      <div className="font-semibold text-blue-400">{result.downloadSpeed.toFixed(1)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">上传</div>
                      <div className="font-semibold text-purple-400">{result.uploadSpeed.toFixed(1)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">延迟</div>
                      <div className="font-semibold text-yellow-400">{result.ping}ms</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// 流媒体检测 Tab
function MediaTestTab() {
  const { t } = useTranslation()
  const [testing, setTesting] = useState(false)
  const [currentRegion, setCurrentRegion] = useState('--')

  // 获取当前节点地区
  useEffect(() => {
    // TODO: 从 API 获取当前节点的地区信息
    // api.get('/proxy/current-node').then(res => setCurrentRegion(res.region))
  }, [])

  const handleTest = () => {
    setTesting(true)
    // TODO: 实际调用流媒体检测 API
    setTimeout(() => {
      setTesting(false)
      setCurrentRegion('US') // 模拟获取到地区
      toast.success(t('tools.testComplete'))
    }, 3000)
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
          <Tv className="w-5 h-5 text-warning" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">{t('tools.mediaTest')}</h2>
          <p className="text-sm text-muted-foreground">{t('tools.mediaTestDesc')}</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-6">
        {mediaServices.map(service => (
          <MediaItem 
            key={service.id} 
            name={service.name} 
            status="unlock" 
            region={currentRegion} 
            icon={service.icon} 
          />
        ))}
      </div>

      <button 
        onClick={handleTest}
        disabled={testing}
        className="w-full inline-flex items-center justify-center px-4 py-3 rounded-lg bg-warning/10 text-warning border border-warning/30 hover:bg-warning/20 transition-colors disabled:opacity-50"
      >
        <Play className="w-4 h-4 mr-2" />
        {testing ? t('tools.testing') : t('tools.startTest')}
      </button>
    </div>
  )
}

function MediaItem({ name, status, region, icon }: { name: string; status: string; region: string; icon: string }) {
  const { t } = useTranslation()
  const IconComponent = mediaIconMap[icon]
  
  // 状态映射
  const statusText = status === 'unlock' ? t('tools.unlocked') : status === 'lock' ? t('tools.locked') : t('tools.unknown')
  const statusColor = status === 'unlock' ? 'text-success' : status === 'lock' ? 'text-destructive' : 'text-muted-foreground'
  
  return (
    <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border">
      <div className="flex items-center gap-3">
        {IconComponent && <IconComponent className="w-5 h-5" />}
        <span className="font-medium">{name}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className={`text-sm ${statusColor}`}>✓ {statusText}</span>
        <span className="px-2 py-0.5 rounded text-xs bg-primary/10 text-primary">{region}</span>
      </div>
    </div>
  )
}
