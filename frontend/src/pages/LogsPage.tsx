import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { 
  FileText, RefreshCw, Trash2, Download,
  AlertCircle, AlertTriangle, Info, Loader2,
  ArrowDown
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/api/client'

type LogLevel = 'all' | 'info' | 'warn' | 'error'

export default function LogsPage() {
  const { t } = useTranslation()
  const [logs, setLogs] = useState<string[]>([])
  const [level, setLevel] = useState<LogLevel>('all')
  const [loading, setLoading] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [autoScroll, setAutoScroll] = useState(true)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const logsEndRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const loadLogs = async () => {
    try {
      const data = await api.get<string[]>(`/proxy/logs?limit=500&level=${level}`)
      setLogs(data || [])
    } catch (e) {
      console.error('加载日志失败', e)
      setLogs([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLogs()
  }, [level])

  useEffect(() => {
    if (!autoRefresh) return
    const timer = setInterval(loadLogs, 2000)
    return () => clearInterval(timer)
  }, [autoRefresh, level])

  // 用户是否正在查看历史日志（手动向上滚动了）
  const userScrolledUpRef = useRef(false)

  // 检测是否滚动到底部
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current
    const atBottom = scrollHeight - scrollTop - clientHeight < 50
    setIsAtBottom(atBottom)
    
    // 用户向上滚动时，标记为正在查看历史
    if (!atBottom) {
      userScrolledUpRef.current = true
      setAutoScroll(false)
    }
  }, [])

  // 只有用户没有向上滚动时才自动滚动
  useEffect(() => {
    if (autoScroll && !userScrolledUpRef.current) {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs, autoScroll])

  // 滚动到底部
  const scrollToBottom = () => {
    userScrolledUpRef.current = false // 重置标记
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    setAutoScroll(true)
    setIsAtBottom(true)
  }

  const handleClear = async () => {
    // 前端清空显示
    setLogs([])
    toast.success(t('logs.cleared'))
  }

  const handleExport = () => {
    const content = logs.join('\n')
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `p-box-logs-${new Date().toISOString().slice(0, 10)}.txt`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(t('logs.exported'))
  }

  const getLogLevel = (log: string): 'info' | 'warn' | 'error' | 'debug' => {
    if (log.includes('ERR') || log.includes('FATA') || log.includes('error')) return 'error'
    if (log.includes('WARN') || log.includes('warning')) return 'warn'
    if (log.includes('INFO') || log.includes('info')) return 'info'
    return 'debug'
  }

  const getLogColor = (level: string) => {
    switch (level) {
      case 'error': return 'text-red-500'
      case 'warn': return 'text-yellow-500'
      case 'info': return 'text-blue-500'
      default: return 'text-muted-foreground'
    }
  }

  const getLogIcon = (level: string) => {
    switch (level) {
      case 'error': return <AlertCircle className="w-4 h-4 text-red-500" />
      case 'warn': return <AlertTriangle className="w-4 h-4 text-yellow-500" />
      case 'info': return <Info className="w-4 h-4 text-blue-500" />
      default: return <FileText className="w-4 h-4 text-muted-foreground" />
    }
  }

  const levels: { value: LogLevel; label: string; color: string }[] = [
    { value: 'all', label: t('logs.all'), color: 'bg-muted' },
    { value: 'info', label: t('logs.info'), color: 'bg-blue-500' },
    { value: 'warn', label: t('logs.warn'), color: 'bg-yellow-500' },
    { value: 'error', label: t('logs.error'), color: 'bg-red-500' },
  ]

  return (
    <div className="flex flex-col h-full">
      {/* 顶部工具栏 */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <p className="text-sm text-muted-foreground">
          {t('logs.logCount', { count: logs.length })} {autoRefresh && `· ${t('logs.autoRefresh')}`}
        </p>
        <div className="flex items-center gap-2">
          {/* 级别筛选 */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/50">
            {levels.map((l) => (
              <button
                key={l.value}
                onClick={() => setLevel(l.value)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  level === l.value
                    ? 'bg-background shadow-sm'
                    : 'hover:bg-background/50'
                }`}
              >
                <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${l.color}`} />
                {l.label}
              </button>
            ))}
          </div>

          {/* 自动刷新 */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`p-2 rounded-lg transition-colors ${
              autoRefresh ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'
            }`}
            title={autoRefresh ? t('logs.autoRefreshOn') : t('logs.autoRefreshOff')}
          >
            <RefreshCw className={`w-4 h-4 ${autoRefresh ? 'animate-spin' : ''}`} />
          </button>

          {/* 手动刷新 */}
          <button
            onClick={loadLogs}
            className="p-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
            title={t('logs.refresh')}
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* 导出 */}
          <button
            onClick={handleExport}
            className="p-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
            title={t('logs.export')}
          >
            <Download className="w-4 h-4" />
          </button>

          {/* 清空 */}
          <button
            onClick={handleClear}
            className="p-2 rounded-lg bg-muted hover:bg-destructive/10 hover:text-destructive transition-colors"
            title={t('logs.clear')}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 日志内容 */}
      <div className="flex-1 rounded-xl border border-border bg-card overflow-hidden relative">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <FileText className="w-12 h-12 mb-4 opacity-50" />
            <p>{t('logs.noLogs')}</p>
            <p className="text-sm mt-1">{t('logs.noLogsHint')}</p>
          </div>
        ) : (
          <div 
            ref={containerRef}
            onScroll={handleScroll}
            className="h-full overflow-auto p-4 font-mono text-sm"
          >
            {logs.map((log, index) => {
              const logLevel = getLogLevel(log)
              return (
                <div
                  key={index}
                  className={`flex items-start gap-2 py-1 hover:bg-muted/30 px-2 -mx-2 rounded ${
                    logLevel === 'error' ? 'bg-red-500/5' : ''
                  }`}
                >
                  <span className="flex-shrink-0 mt-0.5">
                    {getLogIcon(logLevel)}
                  </span>
                  <span className={getLogColor(logLevel)}>{log}</span>
                </div>
              )
            })}
            <div ref={logsEndRef} />
          </div>
        )}
        
        {/* 滚动到底部按钮 */}
        {!isAtBottom && logs.length > 0 && (
          <button
            onClick={scrollToBottom}
            className="absolute bottom-4 right-4 p-2 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-all"
            title={t('logs.scrollToBottom')}
          >
            <ArrowDown className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 底部状态栏 */}
      <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground flex-shrink-0">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            {t('logs.info')} {logs.filter(l => getLogLevel(l) === 'info').length}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-yellow-500" />
            {t('logs.warn')} {logs.filter(l => getLogLevel(l) === 'warn').length}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            {t('logs.error')} {logs.filter(l => getLogLevel(l) === 'error').length}
          </span>
        </div>
        <span>{t('logs.lastUpdate')}: {new Date().toLocaleTimeString()}</span>
      </div>
    </div>
  )
}
