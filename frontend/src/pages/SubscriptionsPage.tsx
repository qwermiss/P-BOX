import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Plus, RefreshCw, Trash2, ListTree, Settings2, Loader2, X } from 'lucide-react'
import { subscriptionApi, type Subscription, type AddSubscriptionRequest } from '@/api/subscription'

// 默认过滤关键词列表（常用的需要过滤掉的文本）
const DEFAULT_KEYWORDS = [
  '过期时间', '剩余流量', 'QQ群', '官网', '到期', '节点', '更新', '距离',
  '套餐', '流量', '过期', '剩余', '倍率', '异常', 'QQ', '官方', '公告'
]

// 请求头预设模板
const HEADER_PRESETS: Record<string, { name: string; headers: Record<string, string> }> = {
  'default': {
    name: '默认',
    headers: {
      'User-Agent': 'P-BOX/1.0',
    }
  },
  'clash': {
    name: 'Clash',
    headers: {
      'User-Agent': 'clash.meta',
    }
  },
  'v2rayn': {
    name: 'v2rayN',
    headers: {
      'User-Agent': 'v2rayN',
    }
  },
  'quantumult': {
    name: 'Quantumult X',
    headers: {
      'User-Agent': 'Quantumult%20X',
    }
  },
}

export default function SubscriptionsPage() {
  const { t } = useTranslation()
  const [subs, setSubs] = useState<Subscription[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingSub, setEditingSub] = useState<Subscription | null>(null)

  // 加载订阅列表
  const loadSubs = async () => {
    try {
      const data = await subscriptionApi.list()
      setSubs(data || [])
    } catch (e: any) {
      console.error('Failed to load subscriptions', e)
      // 不显示错误，可能是首次加载没有数据
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSubs()
  }, [])

  // 刷新单个订阅
  const handleRefresh = async (id: string) => {
    setRefreshing(id)
    try {
      await subscriptionApi.refresh(id)
      await loadSubs()
      toast.success('刷新成功')
    } catch (e: any) {
      console.error('Refresh error:', e)
      toast.error(e.message || '刷新失败')
    } finally {
      setRefreshing(null)
    }
  }

  // 刷新全部
  const handleRefreshAll = async () => {
    setRefreshing('all')
    try {
      await subscriptionApi.refreshAll()
      await loadSubs()
      toast.success('全部刷新成功')
    } catch (e: any) {
      console.error('Refresh all error:', e)
      toast.error(e.message || '刷新失败')
    } finally {
      setRefreshing(null)
    }
  }

  // 删除订阅
  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`确定删除订阅 "${name}" 吗？`)) return
    
    try {
      await subscriptionApi.delete(id)
      setSubs(subs.filter(s => s.id !== id))
      toast.success('删除成功')
    } catch (e: any) {
      console.error('Delete error:', e)
      toast.error(e.message || '删除失败')
    }
  }

  // 格式化流量
  const formatTraffic = (bytes?: number) => {
    if (!bytes) return '-'
    const gb = bytes / 1024 / 1024 / 1024
    return gb.toFixed(2) + ' GB'
  }

  return (
    <div className="space-y-3 lg:space-y-4">
      <div className="flex items-center justify-end gap-2">
          <button
            onClick={handleRefreshAll}
            disabled={refreshing === 'all'}
            className="inline-flex items-center px-3 lg:px-4 py-1.5 lg:py-2 text-sm rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 mr-1 lg:mr-2 ${refreshing === 'all' ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{t('subscriptions.refreshAll')}</span>
            <span className="sm:hidden">刷新</span>
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center px-3 lg:px-4 py-1.5 lg:py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4 mr-1 lg:mr-2" />
            <span className="hidden sm:inline">{t('subscriptions.addSubscription')}</span>
            <span className="sm:hidden">添加</span>
          </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : subs.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {t('subscriptions.noSubscriptions')}
        </div>
      ) : (
        <div className="grid gap-3 lg:gap-4">
          {subs.map((sub) => (
            <div key={sub.id} className="rounded-xl border border-border bg-card p-3 lg:p-5">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="flex items-center gap-3 lg:gap-4 min-w-0">
                  <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shrink-0">
                    <ListTree className="w-5 h-5 lg:w-6 lg:h-6 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-base lg:text-lg truncate">{sub.name}</h3>
                      {sub.autoUpdate && (
                        <span className="px-2 py-0.5 rounded text-xs bg-success/10 text-success whitespace-nowrap">
                          自动更新
                        </span>
                      )}
                    </div>
                    <p className="text-xs lg:text-sm text-muted-foreground mt-0.5 truncate">{sub.url}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleRefresh(sub.id)}
                    disabled={refreshing === sub.id}
                    className="p-2 rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${refreshing === sub.id ? 'animate-spin' : ''}`} />
                  </button>
                  <button
                    onClick={() => setEditingSub(sub)}
                    className="p-2 rounded-lg hover:bg-muted transition-colors"
                  >
                    <Settings2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(sub.id, sub.name)}
                    className="p-2 rounded-lg hover:bg-destructive/10 text-destructive transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t border-border">
                <div>
                  <div className="text-sm text-muted-foreground">{t('subscriptions.nodeCount')}</div>
                  <div className="font-semibold mt-1">
                    {sub.filteredNodeCount !== sub.nodeCount ? (
                      <span>
                        <span className="text-primary">{sub.filteredNodeCount}</span>
                        <span className="text-muted-foreground text-sm"> / {sub.nodeCount}</span>
                      </span>
                    ) : (
                      sub.nodeCount
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">{t('subscriptions.usage')}</div>
                  <div className="font-semibold mt-1">
                    {sub.traffic ? `${formatTraffic(sub.traffic.download)} / ${formatTraffic(sub.traffic.total)}` : '-'}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">{t('subscriptions.lastUpdate')}</div>
                  <div className="font-semibold mt-1">
                    {sub.updatedAt ? new Date(sub.updatedAt).toLocaleString() : '-'}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">{t('subscriptions.updateInterval')}</div>
                  <div className="font-semibold mt-1">
                    {sub.autoUpdate ? `${Math.floor(sub.updateInterval / 3600)}h` : '-'}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 添加订阅弹窗 */}
      {showAddModal && (
        <AddSubscriptionModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false)
            loadSubs()
          }}
        />
      )}

      {/* 编辑订阅弹窗 */}
      {editingSub && (
        <EditSubscriptionModal
          subscription={editingSub}
          onClose={() => setEditingSub(null)}
          onSuccess={() => {
            setEditingSub(null)
            loadSubs()
          }}
        />
      )}
    </div>
  )
}

// 添加订阅弹窗组件
function AddSubscriptionModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [keywords, setKeywords] = useState<string[]>([])
  const [newKeyword, setNewKeyword] = useState('')
  const [headerPreset, setHeaderPreset] = useState('default')
  const [form, setForm] = useState<AddSubscriptionRequest>({
    name: '',
    url: '',
    autoUpdate: true,
    updateInterval: 86400,
    filterKeywords: [],
    filterMode: 'exclude',
    customHeaders: HEADER_PRESETS['default'].headers,
  })

  // 添加关键词
  const addKeyword = (keyword: string) => {
    if (keyword && !keywords.includes(keyword)) {
      setKeywords([...keywords, keyword])
    }
    setNewKeyword('')
  }

  // 删除关键词
  const removeKeyword = (keyword: string) => {
    setKeywords(keywords.filter(k => k !== keyword))
  }

  // 使用默认关键词
  const useDefaultKeywords = () => {
    setKeywords([...new Set([...keywords, ...DEFAULT_KEYWORDS])])
  }

  // 切换请求头预设
  const handlePresetChange = (preset: string) => {
    setHeaderPreset(preset)
    setForm({ ...form, customHeaders: HEADER_PRESETS[preset]?.headers || {} })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      toast.error('请填写订阅名称')
      return
    }
    if (!form.url.trim()) {
      toast.error('请填写订阅链接')
      return
    }
    if (!form.url.startsWith('http://') && !form.url.startsWith('https://')) {
      toast.error('订阅链接必须以 http:// 或 https:// 开头')
      return
    }

    setLoading(true)
    try {
      await subscriptionApi.add({ ...form, filterKeywords: keywords })
      toast.success('订阅添加成功')
      onSuccess()
    } catch (e: any) {
      console.error('Add subscription error:', e)
      toast.error(e.message || '添加订阅失败，请检查链接是否正确')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-card rounded-xl p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-4">{t('subscriptions.addSubscription')}</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">{t('subscriptions.name')}</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background"
              placeholder="我的订阅"
            />
          </div>
          
          <div>
            <label className="text-sm font-medium mb-1 block">{t('subscriptions.url')}</label>
            <input
              type="text"
              value={form.url}
              onChange={e => setForm({ ...form, url: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background"
              placeholder="https://..."
            />
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.autoUpdate}
                onChange={e => setForm({ ...form, autoUpdate: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm">{t('subscriptions.autoUpdate')}</span>
            </label>
            
            {form.autoUpdate && (
              <select
                value={form.updateInterval}
                onChange={e => setForm({ ...form, updateInterval: Number(e.target.value) })}
                className="px-3 py-1 rounded-lg border border-border bg-background text-sm"
              >
                <option value={3600}>1 {t('subscriptions.hours')}</option>
                <option value={21600}>6 {t('subscriptions.hours')}</option>
                <option value={43200}>12 {t('subscriptions.hours')}</option>
                <option value={86400}>24 {t('subscriptions.hours')}</option>
              </select>
            )}
          </div>

          {/* 过滤关键词 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">{t('subscriptions.filterKeywords')}</label>
              <button
                type="button"
                onClick={useDefaultKeywords}
                className="text-xs text-primary hover:underline"
              >
                使用默认关键词
              </button>
            </div>
            
            {/* 已添加的关键词 */}
            {keywords.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {keywords.map(keyword => (
                  <span key={keyword} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted text-sm">
                    {keyword}
                    <button type="button" onClick={() => removeKeyword(keyword)} className="hover:text-destructive">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            
            {/* 添加关键词输入 */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newKeyword}
                onChange={e => setNewKeyword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addKeyword(newKeyword))}
                placeholder={t('subscriptions.filterKeywordsHint')}
                className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm"
              />
              <button
                type="button"
                onClick={() => addKeyword(newKeyword)}
                className="px-3 py-2 rounded-lg border border-border hover:bg-muted text-sm"
              >
                添加
              </button>
            </div>

            {/* 过滤模式 */}
            <div className="flex gap-4 mt-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="filterMode"
                  checked={form.filterMode === 'exclude'}
                  onChange={() => setForm({ ...form, filterMode: 'exclude' })}
                />
                {t('subscriptions.filterExclude')}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="filterMode"
                  checked={form.filterMode === 'include'}
                  onChange={() => setForm({ ...form, filterMode: 'include' })}
                />
                {t('subscriptions.filterInclude')}
              </label>
            </div>
          </div>

          {/* 请求头预设 */}
          <div>
            <label className="text-sm font-medium mb-1 block">{t('subscriptions.customHeaders')}</label>
            <select
              value={headerPreset}
              onChange={e => handlePresetChange(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
            >
              {Object.entries(HEADER_PRESETS).map(([key, preset]) => (
                <option key={key} value={key}>{preset.name}</option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-border hover:bg-muted transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : t('common.confirm')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// 编辑订阅弹窗组件
function EditSubscriptionModal({ 
  subscription, 
  onClose, 
  onSuccess 
}: { 
  subscription: Subscription
  onClose: () => void
  onSuccess: () => void 
}) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [keywords, setKeywords] = useState<string[]>(subscription.filterKeywords || [])
  const [newKeyword, setNewKeyword] = useState('')
  const [headerPreset, setHeaderPreset] = useState('default')
  const [form, setForm] = useState<AddSubscriptionRequest>({
    name: subscription.name,
    url: subscription.url,
    autoUpdate: subscription.autoUpdate,
    updateInterval: subscription.updateInterval,
    filterKeywords: subscription.filterKeywords || [],
    filterMode: subscription.filterMode || 'exclude',
    customHeaders: subscription.customHeaders || HEADER_PRESETS['default'].headers,
  })

  const addKeyword = (keyword: string) => {
    if (keyword && !keywords.includes(keyword)) {
      setKeywords([...keywords, keyword])
    }
    setNewKeyword('')
  }

  const removeKeyword = (keyword: string) => {
    setKeywords(keywords.filter(k => k !== keyword))
  }

  const useDefaultKeywords = () => {
    setKeywords([...new Set([...keywords, ...DEFAULT_KEYWORDS])])
  }

  const handlePresetChange = (preset: string) => {
    setHeaderPreset(preset)
    setForm({ ...form, customHeaders: HEADER_PRESETS[preset]?.headers || {} })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      toast.error('请填写订阅名称')
      return
    }
    if (!form.url.trim()) {
      toast.error('请填写订阅链接')
      return
    }

    setLoading(true)
    try {
      await subscriptionApi.update(subscription.id, { ...form, filterKeywords: keywords })
      toast.success('保存成功')
      onSuccess()
    } catch (e: any) {
      console.error('Update subscription error:', e)
      toast.error(e.message || '保存失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-card rounded-xl p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-4">{t('subscriptions.editSubscription')}</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">{t('subscriptions.name')}</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background"
            />
          </div>
          
          <div>
            <label className="text-sm font-medium mb-1 block">{t('subscriptions.url')}</label>
            <input
              type="text"
              value={form.url}
              onChange={e => setForm({ ...form, url: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background"
            />
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.autoUpdate}
                onChange={e => setForm({ ...form, autoUpdate: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm">{t('subscriptions.autoUpdate')}</span>
            </label>
            
            {form.autoUpdate && (
              <select
                value={form.updateInterval}
                onChange={e => setForm({ ...form, updateInterval: Number(e.target.value) })}
                className="px-3 py-1 rounded-lg border border-border bg-background text-sm"
              >
                <option value={3600}>1 {t('subscriptions.hours')}</option>
                <option value={21600}>6 {t('subscriptions.hours')}</option>
                <option value={43200}>12 {t('subscriptions.hours')}</option>
                <option value={86400}>24 {t('subscriptions.hours')}</option>
              </select>
            )}
          </div>

          {/* 过滤关键词 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">{t('subscriptions.filterKeywords')}</label>
              <button type="button" onClick={useDefaultKeywords} className="text-xs text-primary hover:underline">
                使用默认关键词
              </button>
            </div>
            
            {keywords.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {keywords.map(keyword => (
                  <span key={keyword} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted text-sm">
                    {keyword}
                    <button type="button" onClick={() => removeKeyword(keyword)} className="hover:text-destructive">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            
            <div className="flex gap-2">
              <input
                type="text"
                value={newKeyword}
                onChange={e => setNewKeyword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addKeyword(newKeyword))}
                placeholder={t('subscriptions.filterKeywordsHint')}
                className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm"
              />
              <button type="button" onClick={() => addKeyword(newKeyword)} className="px-3 py-2 rounded-lg border border-border hover:bg-muted text-sm">
                添加
              </button>
            </div>

            <div className="flex gap-4 mt-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="editFilterMode"
                  checked={form.filterMode === 'exclude'}
                  onChange={() => setForm({ ...form, filterMode: 'exclude' })}
                />
                {t('subscriptions.filterExclude')}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="editFilterMode"
                  checked={form.filterMode === 'include'}
                  onChange={() => setForm({ ...form, filterMode: 'include' })}
                />
                {t('subscriptions.filterInclude')}
              </label>
            </div>
          </div>

          {/* 请求头预设 */}
          <div>
            <label className="text-sm font-medium mb-1 block">{t('subscriptions.customHeaders')}</label>
            <select
              value={headerPreset}
              onChange={e => handlePresetChange(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
            >
              {Object.entries(HEADER_PRESETS).map(([key, preset]) => (
                <option key={key} value={key}>{preset.name}</option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-border hover:bg-muted transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
