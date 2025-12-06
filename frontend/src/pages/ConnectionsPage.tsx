import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { X, XCircle, ArrowUp, ArrowDown, Search, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { mihomoApi } from '@/api/mihomo'

interface Connection {
  id: string
  metadata: {
    network: string
    type: string
    sourceIP: string
    destinationIP: string
    sourcePort: string
    destinationPort: string
    host: string
    dnsMode: string
    processPath?: string
  }
  upload: number
  download: number
  start: string
  chains: string[]
  rule: string
  rulePayload: string
}

export default function ConnectionsPage() {
  const { t } = useTranslation()
  const [connections, setConnections] = useState<Connection[]>([])
  const [totalUpload, setTotalUpload] = useState(0)
  const [totalDownload, setTotalDownload] = useState(0)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    // 使用 WebSocket 实时更新
    const ws = mihomoApi.createConnectionsWs((data) => {
      setConnections(data.connections || [])
      setTotalUpload(data.uploadTotal || 0)
      setTotalDownload(data.downloadTotal || 0)
      setLoading(false)
    })
    wsRef.current = ws

    ws.onerror = () => {
      setLoading(false)
    }

    return () => {
      ws.close()
    }
  }, [])

  const handleCloseAll = async () => {
    try {
      await mihomoApi.closeAllConnections()
      toast.success('已关闭所有连接')
    } catch (e: any) {
      toast.error(e.message || '关闭失败')
    }
  }

  const handleClose = async (id: string) => {
    try {
      await mihomoApi.closeConnection(id)
    } catch (e: any) {
      toast.error(e.message || '关闭失败')
    }
  }

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(2) + ' MB'
    return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB'
  }

  // 过滤连接
  const filteredConnections = connections.filter(conn => {
    if (!search) return true
    const searchLower = search.toLowerCase()
    return (
      conn.metadata.host?.toLowerCase().includes(searchLower) ||
      conn.metadata.destinationIP?.includes(search) ||
      conn.chains.some(c => c.toLowerCase().includes(searchLower)) ||
      conn.rule?.toLowerCase().includes(searchLower)
    )
  })

  return (
    <div className="space-y-3 lg:space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <p className="text-xs lg:text-sm text-muted-foreground">
          {connections.length} 个连接 · ↑ {formatBytes(totalUpload)} · ↓ {formatBytes(totalDownload)}
        </p>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索..."
              className="w-full sm:w-40 lg:w-48 pl-9 pr-4 py-1.5 lg:py-2 rounded-lg border border-border bg-background text-sm"
            />
          </div>
          <button 
            onClick={handleCloseAll}
            className="inline-flex items-center px-3 lg:px-4 py-1.5 lg:py-2 text-sm rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors whitespace-nowrap"
          >
            <XCircle className="w-4 h-4 mr-1 lg:mr-2" />
            <span className="hidden sm:inline">{t('connections.closeAll')}</span>
            <span className="sm:hidden">关闭</span>
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredConnections.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            {connections.length === 0 ? '暂无活动连接' : '没有匹配的连接'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">{t('connections.host')}</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">{t('connections.network')}</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">{t('connections.rule')}</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">{t('connections.chains')}</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                    <ArrowUp className="w-4 h-4 inline mr-1" />
                    <ArrowDown className="w-4 h-4 inline" />
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredConnections.slice(0, 100).map((conn) => (
                  <tr key={conn.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2.5">
                      <div className="font-medium truncate max-w-[200px]" title={conn.metadata.host || conn.metadata.destinationIP}>
                        {conn.metadata.host || conn.metadata.destinationIP}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        :{conn.metadata.destinationPort}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-sm">
                      <span className="px-1.5 py-0.5 rounded text-xs bg-muted">
                        {conn.metadata.network}/{conn.metadata.type}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="px-2 py-0.5 rounded text-xs bg-primary/10 text-primary">
                        {conn.rule}
                      </span>
                      {conn.rulePayload && (
                        <span className="ml-1 text-xs text-muted-foreground">{conn.rulePayload}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-muted-foreground truncate max-w-[150px]" title={conn.chains.join(' → ')}>
                      {conn.chains.join(' → ')}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs">
                      <span className="text-green-500">{formatBytes(conn.upload)}</span>
                      <span className="mx-1 text-muted-foreground">/</span>
                      <span className="text-blue-500">{formatBytes(conn.download)}</span>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <button 
                        onClick={() => handleClose(conn.id)}
                        className="p-1 rounded hover:bg-destructive/10 text-destructive transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredConnections.length > 100 && (
              <div className="text-center py-2 text-sm text-muted-foreground bg-muted/30">
                仅显示前 100 条连接，共 {filteredConnections.length} 条
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
