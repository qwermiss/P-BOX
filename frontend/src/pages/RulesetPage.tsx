import { useState, useEffect } from 'react'
import { 
  Download, Check, X, Clock,
  Globe, Shield, Loader2, Settings
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/api/client'

interface RuleFile {
  name: string
  url: string
  path: string
  description: string
  size: number
  updatedAt: string
  status: 'pending' | 'downloading' | 'completed' | 'failed'
}

interface RuleSetConfig {
  autoUpdate: boolean
  updateInterval: number
  lastUpdate: string
}

export default function RulesetPage() {
  const [geoFiles, setGeoFiles] = useState<RuleFile[]>([])
  const [providerFiles, setProviderFiles] = useState<RuleFile[]>([])
  const [config, setConfig] = useState<RuleSetConfig>({
    autoUpdate: true,
    updateInterval: 1,
    lastUpdate: ''
  })
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    loadData()
    const interval = setInterval(checkStatus, 3000)
    return () => clearInterval(interval)
  }, [])

  const loadData = async () => {
    try {
      const [geoRes, providerRes, configRes] = await Promise.all([
        api.get<RuleFile[]>('/ruleset/geo'),
        api.get<RuleFile[]>('/ruleset/providers'),
        api.get<RuleSetConfig>('/ruleset/config')
      ])
      setGeoFiles(geoRes)
      setProviderFiles(providerRes)
      setConfig(configRes)
    } catch (err) {
      toast.error('加载规则数据失败')
    } finally {
      setLoading(false)
    }
  }

  const checkStatus = async () => {
    try {
      const status = await api.get<{ updating: boolean; lastUpdate: string }>('/ruleset/status')
      setUpdating(status.updating)
      if (!status.updating && updating) {
        // 更新完成，刷新数据
        loadData()
      }
    } catch {
      // ignore
    }
  }

  const handleUpdateAll = async () => {
    try {
      setUpdating(true)
      await api.post('/ruleset/update')
      toast.success('开始更新规则文件')
    } catch (err) {
      toast.error('启动更新失败')
      setUpdating(false)
    }
  }

  const handleSaveConfig = async () => {
    try {
      await api.put('/ruleset/config', config)
      toast.success('配置已保存')
    } catch (err) {
      toast.error('保存配置失败')
    }
  }

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '-'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <Check className="h-4 w-4 text-green-500" />
      case 'downloading':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
      case 'failed':
        return <X className="h-4 w-4 text-red-500" />
      default:
        return <Clock className="h-4 w-4 text-gray-400" />
    }
  }

  const completedCount = [...geoFiles, ...providerFiles].filter(f => f.status === 'completed').length
  const totalCount = geoFiles.length + providerFiles.length

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 头部统计 */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          已下载 {completedCount}/{totalCount} 个规则文件
          {config.lastUpdate && ` · 最后更新: ${config.lastUpdate}`}
        </p>
        <button
          onClick={handleUpdateAll}
          disabled={updating}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
        >
          {updating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          {updating ? '更新中...' : '全部更新'}
        </button>
      </div>

      {/* 配置区域 */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-4">
          <Settings className="h-5 w-5" />
          <span className="font-medium">更新设置</span>
        </div>
        <div className="flex flex-wrap items-center gap-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={config.autoUpdate}
              onChange={(e) => setConfig({ ...config, autoUpdate: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300"
            />
            <span className="text-sm">自动更新</span>
          </label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">更新间隔:</span>
            <select
              value={config.updateInterval}
              onChange={(e) => setConfig({ ...config, updateInterval: Number(e.target.value) })}
              className="px-3 py-1.5 text-sm bg-background border border-border rounded-lg"
            >
              <option value={1}>1 天</option>
              <option value={2}>2 天</option>
              <option value={3}>3 天</option>
              <option value={5}>5 天</option>
              <option value={7}>7 天</option>
            </select>
          </div>
          <button
            onClick={handleSaveConfig}
            className="px-3 py-1.5 text-sm bg-secondary hover:bg-secondary/80 rounded-lg"
          >
            保存设置
          </button>
        </div>
      </div>

      {/* GEO 数据库 */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <Globe className="h-5 w-5 text-blue-500" />
          <span className="font-medium">GEO 数据库</span>
          <span className="text-xs text-muted-foreground">({geoFiles.length})</span>
        </div>
        <div className="divide-y divide-border">
          {geoFiles.map((file) => (
            <div key={file.name} className="px-4 py-3 flex items-center justify-between hover:bg-accent/50">
              <div className="flex items-center gap-3">
                {getStatusIcon(file.status)}
                <div>
                  <div className="font-medium text-sm">{file.name}</div>
                  <div className="text-xs text-muted-foreground">{file.description}</div>
                </div>
              </div>
              <div className="text-right text-sm">
                <div className="text-muted-foreground">{formatSize(file.size)}</div>
                {file.updatedAt && (
                  <div className="text-xs text-muted-foreground">{file.updatedAt}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 规则提供者 */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <Shield className="h-5 w-5 text-green-500" />
          <span className="font-medium">规则提供者</span>
          <span className="text-xs text-muted-foreground">({providerFiles.length})</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 divide-border">
          {providerFiles.map((file, index) => (
            <div 
              key={file.name} 
              className={`px-4 py-3 flex items-center justify-between hover:bg-accent/50 ${
                index % 2 === 0 ? 'md:border-r border-border' : ''
              } ${index >= 2 ? 'md:border-t border-border' : ''}`}
            >
              <div className="flex items-center gap-3 min-w-0">
                {getStatusIcon(file.status)}
                <div className="min-w-0">
                  <div className="font-medium text-sm truncate">{file.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{file.description}</div>
                </div>
              </div>
              <div className="text-right text-sm flex-shrink-0 ml-2">
                <div className="text-muted-foreground">{formatSize(file.size)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
