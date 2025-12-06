import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { 
  Globe, Zap, Plus, Trash2, Share2, 
  Loader2, Search, X, Copy, Check, Filter, ChevronDown
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { nodeApi, type Node } from '@/api/node'
import { subscriptionApi, type Subscription } from '@/api/subscription'

// 国家/地区关键词映射
const COUNTRY_KEYWORDS: Record<string, string[]> = {
  '香港': ['香港', 'HK', 'Hong Kong', 'HongKong'],
  '台湾': ['台湾', 'TW', 'Taiwan'],
  '日本': ['日本', 'JP', 'Japan', '东京', 'Tokyo'],
  '新加坡': ['新加坡', 'SG', 'Singapore'],
  '美国': ['美国', 'US', 'USA', 'United States', '洛杉矶', '硅谷'],
  '韩国': ['韩国', 'KR', 'Korea', '首尔'],
  '英国': ['英国', 'UK', 'Britain', '伦敦'],
  '德国': ['德国', 'DE', 'Germany'],
  '澳大利亚': ['澳大利亚', 'AU', 'Australia'],
  '加拿大': ['加拿大', 'CA', 'Canada'],
}

// 检测节点国家
function detectCountry(nodeName: string): string {
  for (const [country, keywords] of Object.entries(COUNTRY_KEYWORDS)) {
    if (keywords.some(k => nodeName.toLowerCase().includes(k.toLowerCase()))) {
      return country
    }
  }
  return '其他'
}

export default function NodesPage() {
  const { t } = useTranslation()
  const [nodes, setNodes] = useState<Node[]>([])
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [loading, setLoading] = useState(true)
  const [testing, setTesting] = useState<Set<string>>(new Set())
  const [testingAll, setTestingAll] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [showImportModal, setShowImportModal] = useState(false)
  const [showQRModal, setShowQRModal] = useState<{ url: string; name: string } | null>(null)
  const [delayResults, setDelayResults] = useState<Record<string, number>>({})
  const [showFilters, setShowFilters] = useState(false)
  
  // 过滤条件
  const [filters, setFilters] = useState({
    source: 'all' as 'all' | 'manual' | string, // 'all', 'manual', 或订阅ID
    protocol: 'all' as string,
    country: 'all' as string,
    delay: 'all' as 'all' | 'fast' | 'medium' | 'slow' | 'timeout' | 'untested',
  })

  // 加载节点和订阅
  const loadData = async () => {
    try {
      const [nodesData, subsData] = await Promise.all([
        nodeApi.list(),
        subscriptionApi.list()
      ])
      setNodes(nodesData || [])
      setSubscriptions(subsData || [])
    } catch (e: any) {
      console.error('Load data error:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // 获取可用的过滤选项
  const filterOptions = useMemo(() => {
    const protocols = [...new Set(nodes.map(n => n.type.toUpperCase()))]
    const countries = [...new Set(nodes.map(n => detectCountry(n.name)))]
    return { protocols, countries }
  }, [nodes])

  // 过滤节点
  const filteredNodes = useMemo(() => {
    return nodes.filter(node => {
      // 搜索过滤
      const matchSearch = !searchTerm || 
        node.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        node.server.toLowerCase().includes(searchTerm.toLowerCase()) ||
        node.type.toLowerCase().includes(searchTerm.toLowerCase())
      
      if (!matchSearch) return false

      // 来源过滤
      if (filters.source !== 'all') {
        if (filters.source === 'manual' && !node.isManual) return false
        if (filters.source !== 'manual' && node.subscriptionId !== filters.source) return false
      }

      // 协议过滤
      if (filters.protocol !== 'all' && node.type.toUpperCase() !== filters.protocol) {
        return false
      }

      // 国家过滤
      if (filters.country !== 'all' && detectCountry(node.name) !== filters.country) {
        return false
      }

      // 延迟过滤
      const delay = delayResults[node.id] ?? node.delay
      if (filters.delay !== 'all') {
        if (filters.delay === 'untested' && delay !== -1) return false
        if (filters.delay === 'fast' && (delay <= 0 || delay >= 100)) return false
        if (filters.delay === 'medium' && (delay < 100 || delay >= 200)) return false
        if (filters.delay === 'slow' && (delay < 200 || delay === 0)) return false
        if (filters.delay === 'timeout' && delay !== 0) return false
      }

      return true
    })
  }, [nodes, searchTerm, filters, delayResults])

  // 测试单个节点
  const handleTestOne = async (node: Node) => {
    setTesting(prev => new Set(prev).add(node.id))
    try {
      const result = await nodeApi.testDelay(node.id, node.server, node.serverPort, 5000)
      setDelayResults(prev => ({ ...prev, [node.id]: result.delay }))
    } catch (e) {
      setDelayResults(prev => ({ ...prev, [node.id]: 0 }))
    } finally {
      setTesting(prev => {
        const next = new Set(prev)
        next.delete(node.id)
        return next
      })
    }
  }

  // 批量测试
  const handleTestAll = async () => {
    if (filteredNodes.length === 0) return
    
    setTestingAll(true)
    const nodeIds = filteredNodes.map(n => n.id)
    setTesting(new Set(nodeIds))
    
    try {
      const results = await nodeApi.testDelayBatch(nodeIds, 5000)
      setDelayResults(prev => ({ ...prev, ...results }))
      toast.success(`测速完成，共 ${Object.keys(results).length} 个节点`)
    } catch (e: any) {
      toast.error(e.message || '测速失败')
    } finally {
      setTestingAll(false)
      setTesting(new Set())
    }
  }

  // 删除节点
  const handleDelete = async (node: Node) => {
    if (!node.isManual) {
      toast.error('订阅节点不可删除')
      return
    }
    if (!confirm(`确定删除节点 "${node.name}" 吗？`)) return

    try {
      await nodeApi.delete(node.id)
      setNodes(nodes.filter(n => n.id !== node.id))
      toast.success('删除成功')
    } catch (e: any) {
      toast.error(e.message || '删除失败')
    }
  }

  // 获取节点分享链接
  const getNodeShareUrl = async (node: Node): Promise<string | null> => {
    // 如果已有分享链接直接返回
    if (node.shareUrl) return node.shareUrl
    
    // 尝试从后端获取
    try {
      const result = await nodeApi.getShareUrl(node.id)
      return result.url
    } catch {
      return null
    }
  }

  // 分享节点（显示二维码）
  const handleShare = async (node: Node) => {
    const url = await getNodeShareUrl(node)
    if (url) {
      setShowQRModal({ url, name: node.name })
    } else {
      toast.error('该节点暂不支持分享')
    }
  }

  // 复制链接
  const handleCopyUrl = async (node: Node) => {
    const url = await getNodeShareUrl(node)
    if (url) {
      await navigator.clipboard.writeText(url)
      toast.success('链接已复制')
    } else {
      toast.error('该节点暂不支持导出')
    }
  }

  // 获取延迟显示
  const getDelay = (node: Node) => {
    const delay = delayResults[node.id] ?? node.delay
    return delay
  }

  const getDelayColor = (delay: number) => {
    if (delay === -1) return 'text-muted-foreground'
    if (delay === 0) return 'text-destructive'
    if (delay < 100) return 'text-success'
    if (delay < 200) return 'text-warning'
    return 'text-destructive'
  }

  const getDelayText = (delay: number) => {
    if (delay === -1) return '-'
    if (delay === 0) return '超时'
    return `${delay}ms`
  }

  return (
    <div className="space-y-3 lg:space-y-4">
      {/* 顶部操作栏 */}
      <div className="flex items-center justify-end gap-2">
          <button
            onClick={handleTestAll}
            disabled={testingAll || filteredNodes.length === 0}
            className="inline-flex items-center px-3 lg:px-4 py-1.5 lg:py-2 text-sm rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-50"
          >
            <Zap className={`w-4 h-4 mr-1 lg:mr-2 ${testingAll ? 'animate-pulse' : ''}`} />
            <span className="hidden sm:inline">{t('nodes.testAll')}</span>
            <span className="sm:hidden">测速</span>
          </button>
          <button
            onClick={() => setShowImportModal(true)}
            className="inline-flex items-center px-3 lg:px-4 py-1.5 lg:py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4 mr-1 lg:mr-2" />
            <span className="hidden sm:inline">导入节点</span>
            <span className="sm:hidden">导入</span>
          </button>
      </div>

      {/* 搜索和过滤 */}
      <div className="space-y-2 lg:space-y-3">
        <div className="flex gap-2">
          {/* 搜索框 */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder={t('common.search')}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-border bg-background"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
          </div>
          {/* 过滤按钮 */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-2 rounded-lg border transition-colors flex items-center gap-2 ${
              showFilters ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
            }`}
          >
            <Filter className="w-4 h-4" />
            过滤
            <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* 过滤选项 */}
        {showFilters && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 rounded-lg bg-muted/50 border border-border">
            {/* 来源 */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">来源</label>
              <select
                value={filters.source}
                onChange={e => setFilters({ ...filters, source: e.target.value })}
                className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-sm"
              >
                <option value="all">全部来源</option>
                <option value="manual">手动添加</option>
                {subscriptions.map(sub => (
                  <option key={sub.id} value={sub.id}>{sub.name}</option>
                ))}
              </select>
            </div>

            {/* 协议 */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">协议</label>
              <select
                value={filters.protocol}
                onChange={e => setFilters({ ...filters, protocol: e.target.value })}
                className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-sm"
              >
                <option value="all">全部协议</option>
                {filterOptions.protocols.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            {/* 国家/地区 */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">国家/地区</label>
              <select
                value={filters.country}
                onChange={e => setFilters({ ...filters, country: e.target.value })}
                className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-sm"
              >
                <option value="all">全部地区</option>
                {filterOptions.countries.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* 延迟 */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">延迟</label>
              <select
                value={filters.delay}
                onChange={e => setFilters({ ...filters, delay: e.target.value as any })}
                className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-sm"
              >
                <option value="all">全部延迟</option>
                <option value="fast">快速 (&lt;100ms)</option>
                <option value="medium">中等 (100-200ms)</option>
                <option value="slow">较慢 (&gt;200ms)</option>
                <option value="timeout">超时</option>
                <option value="untested">未测试</option>
              </select>
            </div>

            {/* 重置按钮 */}
            <div className="col-span-2 md:col-span-4 flex justify-end">
              <button
                onClick={() => setFilters({ source: 'all', protocol: 'all', country: 'all', delay: 'all' })}
                className="text-sm text-primary hover:underline"
              >
                重置过滤
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 节点统计 */}
      <div className="text-sm text-muted-foreground">
        共 {filteredNodes.length} 个节点
        {(searchTerm || filters.source !== 'all' || filters.protocol !== 'all' || filters.country !== 'all' || filters.delay !== 'all') && 
          ` (已过滤，总共 ${nodes.length} 个)`}
      </div>

      {/* 节点列表 */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredNodes.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {nodes.length === 0 ? t('nodes.noNodes') : '没有匹配的节点'}
        </div>
      ) : (
        <div className="grid gap-2 lg:gap-3">
          {filteredNodes.map((node) => (
            <div
              key={node.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between p-3 lg:p-4 rounded-xl border border-border bg-card hover:bg-muted/50 transition-colors gap-2 sm:gap-4"
            >
              <div className="flex items-center gap-3 lg:gap-4 flex-1 min-w-0">
                <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Globe className="w-4 h-4 lg:w-5 lg:h-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate text-sm lg:text-base">{node.name}</div>
                  <div className="text-xs lg:text-sm text-muted-foreground flex items-center gap-1 lg:gap-2 flex-wrap">
                    <span className="uppercase">{node.type}</span>
                    <span className="hidden sm:inline">•</span>
                    <span className="truncate hidden sm:inline">{node.server}:{node.serverPort}</span>
                    {node.isManual && (
                      <>
                        <span>•</span>
                        <span className="text-primary">手动</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2 shrink-0 justify-end">
                {/* 延迟显示 */}
                <button
                  onClick={() => handleTestOne(node)}
                  disabled={testing.has(node.id)}
                  className={`font-mono min-w-16 text-right ${getDelayColor(getDelay(node))} hover:opacity-70`}
                  title="点击测速"
                >
                  {testing.has(node.id) ? (
                    <Loader2 className="w-4 h-4 animate-spin ml-auto" />
                  ) : (
                    getDelayText(getDelay(node))
                  )}
                </button>
                
                {/* 操作按钮 - 所有节点都显示 */}
                <button
                  onClick={() => handleShare(node)}
                  className="p-2 rounded-lg hover:bg-muted transition-colors"
                  title="分享/二维码"
                >
                  <Share2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleCopyUrl(node)}
                  className="p-2 rounded-lg hover:bg-muted transition-colors"
                  title="复制链接"
                >
                  <Copy className="w-4 h-4" />
                </button>
                {node.isManual && (
                  <button
                    onClick={() => handleDelete(node)}
                    className="p-2 rounded-lg hover:bg-destructive/10 text-destructive transition-colors"
                    title="删除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 导入弹窗 */}
      {showImportModal && (
        <ImportNodeModal
          onClose={() => setShowImportModal(false)}
          onSuccess={() => {
            setShowImportModal(false)
            loadData()
          }}
        />
      )}

      {/* 二维码弹窗 */}
      {showQRModal && (
        <QRCodeModal
          url={showQRModal.url}
          name={showQRModal.name}
          onClose={() => setShowQRModal(null)}
        />
      )}
    </div>
  )
}

// 导入节点弹窗
function ImportNodeModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'url' | 'manual'>('url')
  const [url, setUrl] = useState('')
  const [manualForm, setManualForm] = useState({
    name: '',
    type: 'vmess',
    server: '',
    port: 443,
  })

  const handleImportUrl = async () => {
    if (!url.trim()) {
      toast.error('请输入节点链接')
      return
    }

    setLoading(true)
    try {
      await nodeApi.importUrl(url)
      toast.success('导入成功')
      onSuccess()
    } catch (e: any) {
      toast.error(e.message || '导入失败')
    } finally {
      setLoading(false)
    }
  }

  const handleAddManual = async () => {
    if (!manualForm.name.trim()) {
      toast.error('请输入节点名称')
      return
    }
    if (!manualForm.server.trim()) {
      toast.error('请输入服务器地址')
      return
    }

    setLoading(true)
    try {
      await nodeApi.addManual({
        name: manualForm.name,
        type: manualForm.type,
        server: manualForm.server,
        port: manualForm.port,
      })
      toast.success('添加成功')
      onSuccess()
    } catch (e: any) {
      toast.error(e.message || '添加失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-card rounded-xl p-6 w-full max-w-lg shadow-xl" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-4">添加节点</h2>
        
        {/* 选项卡 */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveTab('url')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              activeTab === 'url' ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'
            }`}
          >
            链接导入
          </button>
          <button
            onClick={() => setActiveTab('manual')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              activeTab === 'manual' ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'
            }`}
          >
            手动添加
          </button>
        </div>

        {activeTab === 'url' ? (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">节点链接</label>
              <textarea
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="vmess://... 或 trojan://... 或 ss://..."
                className="w-full px-3 py-2 rounded-lg border border-border bg-background h-32 resize-none"
              />
              <p className="text-xs text-muted-foreground mt-1">
                支持 vmess, vless, trojan, ss, hysteria2 等协议
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-border hover:bg-muted transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleImportUrl}
                disabled={loading}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : '导入'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">节点名称</label>
              <input
                type="text"
                value={manualForm.name}
                onChange={e => setManualForm({ ...manualForm, name: e.target.value })}
                placeholder="我的节点"
                className="w-full px-3 py-2 rounded-lg border border-border bg-background"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">协议类型</label>
              <select
                value={manualForm.type}
                onChange={e => setManualForm({ ...manualForm, type: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background"
              >
                <option value="vmess">VMess</option>
                <option value="vless">VLESS</option>
                <option value="trojan">Trojan</option>
                <option value="ss">Shadowsocks</option>
                <option value="hysteria2">Hysteria2</option>
                <option value="tuic">TUIC</option>
              </select>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <label className="text-sm font-medium mb-1 block">服务器地址</label>
                <input
                  type="text"
                  value={manualForm.server}
                  onChange={e => setManualForm({ ...manualForm, server: e.target.value })}
                  placeholder="example.com"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">端口</label>
                <input
                  type="number"
                  value={manualForm.port}
                  onChange={e => setManualForm({ ...manualForm, port: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-border hover:bg-muted transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleAddManual}
                disabled={loading}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : '添加'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// 二维码弹窗
function QRCodeModal({ url, name, onClose }: { url: string; name: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    toast.success('已复制到剪贴板')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-card rounded-xl p-6 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-4 text-center">{name}</h2>
        
        <div className="flex flex-col items-center gap-4">
          {/* 二维码 */}
          <div className="p-4 bg-white rounded-lg">
            <QRCodeSVG value={url} size={180} />
          </div>
          
          <div className="w-full">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={url}
                readOnly
                className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm truncate"
              />
              <button
                onClick={handleCopy}
                className="p-2 rounded-lg border border-border hover:bg-muted transition-colors"
              >
                {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-full px-4 py-2 rounded-lg border border-border hover:bg-muted transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}
