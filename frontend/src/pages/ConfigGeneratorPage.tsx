import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  Download,
  Users,
  List,
  Eye,
  Plus,
  Trash2,
  Edit2,
  Save,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  Globe,
  Zap,
  Database,
  GripVertical,
  Rocket,
  Target,
  Bot,
  Tv,
  Film,
  MessageCircle,
  Search,
  Twitter,
  Facebook,
  Gamepad2,
  Apple,
  Github,
  Ban,
  Fish,
  Flag,
  Shield,
  type LucideIcon,
} from 'lucide-react'

// 图标映射（根据 icon 字段）
const iconMap: Record<string, LucideIcon> = {
  zap: Zap,
  rocket: Rocket,
  target: Target,
  bot: Bot,
  globe: Globe,
  'message-circle': MessageCircle,
  search: Search,
  twitter: Twitter,
  facebook: Facebook,
  'gamepad-2': Gamepad2,
  tv: Tv,
  film: Film,
  square: Globe,
  apple: Apple,
  github: Github,
  ban: Ban,
  fish: Fish,
  flag: Flag,
  shield: Shield,
}

const getIcon = (iconName: string): LucideIcon => {
  return iconMap[iconName] || Globe
}

import { api } from '@/api/client'

// 类型定义
interface ProxyGroup {
  name: string
  type: string
  icon: string
  description: string
  enabled: boolean
  proxies: string[]
  url?: string
  interval?: number
  tolerance?: number
  lazy?: boolean
  filter?: string
  useAll?: boolean
}

interface Rule {
  type: string
  payload: string
  proxy: string
  noResolve: boolean
  description: string
}

interface RuleProvider {
  name: string
  type: string
  behavior: string
  url: string
  path: string
  interval: number
  format: string
  description: string
}

interface ConfigTemplate {
  proxyGroups: ProxyGroup[]
  rules: Rule[]
  ruleProviders: RuleProvider[]
}

export default function ConfigGeneratorPage() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState('groups')
  const [template, setTemplate] = useState<ConfigTemplate | null>(null)
  const [loading, setLoading] = useState(true)
  const initializedRef = useRef(false)

  const tabs = [
    { id: 'groups', icon: Users, label: t('configGenerator.proxyGroups') },
    { id: 'rules', icon: List, label: t('configGenerator.rules') },
    { id: 'providers', icon: Database, label: t('configGenerator.rulesets') },
    { id: 'preview', icon: Eye, label: t('configGenerator.preview') },
  ]

  // 加载配置模板
  const loadTemplate = async () => {
    try {
      const data = await api.get<ConfigTemplate>('/proxy/template')
      setTemplate(data)
    } catch (e: any) {
      toast.error(e.message || '加载配置失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true
    loadTemplate()
  }, [])

  // 重置为默认
  const resetTemplate = async () => {
    if (!confirm('确定要重置为默认配置吗？所有自定义修改将丢失。')) return
    try {
      await api.post('/proxy/template/reset', {})
      await loadTemplate()
      toast.success('已重置为默认配置')
    } catch (e: any) {
      toast.error(e.message || '重置失败')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <button
          onClick={resetTemplate}
          className="inline-flex items-center px-4 py-2 rounded-lg border border-border hover:bg-muted transition-colors"
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          {t('configGenerator.resetDefault')}
        </button>
      </div>

      {/* 标签页 */}
      <div className="border-b border-border">
        <div className="flex gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const count = template ? (
              tab.id === 'groups' ? template.proxyGroups.length :
              tab.id === 'rules' ? template.rules.length :
              tab.id === 'providers' ? template.ruleProviders.length : 0
            ) : 0
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="font-medium">{tab.label}</span>
                {count > 0 && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-muted">{count}</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* 内容区 */}
      {template && (
        <div>
          {activeTab === 'groups' && (
            <ProxyGroupsTab template={template} setTemplate={setTemplate} />
          )}
          {activeTab === 'rules' && (
            <RulesTab template={template} setTemplate={setTemplate} />
          )}
          {activeTab === 'providers' && (
            <ProvidersTab template={template} />
          )}
          {activeTab === 'preview' && (
            <PreviewTab template={template} />
          )}
        </div>
      )}
    </div>
  )
}

// 代理组管理 Tab
function ProxyGroupsTab({ 
  template, 
  setTemplate 
}: { 
  template: ConfigTemplate
  setTemplate: (tpl: ConfigTemplate) => void 
}) {
  const { t } = useTranslation()
  const [editingGroup, setEditingGroup] = useState<ProxyGroup | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  const saveGroups = async (groups: ProxyGroup[]) => {
    try {
      await api.put('/proxy/template/groups', groups)
      setTemplate({ ...template, proxyGroups: groups })
      toast.success(t('configGenerator.saveSuccess'))
    } catch (e: any) {
      toast.error(e.message || t('configGenerator.saveFailed'))
    }
  }

  const deleteGroup = (name: string) => {
    if (!confirm(t('configGenerator.confirmDelete', { name }))) return
    const newGroups = template.proxyGroups.filter(g => g.name !== name)
    saveGroups(newGroups)
  }

  const addGroup = () => {
    setEditingGroup({
      name: '',
      type: 'select',
      icon: 'globe',
      description: '',
      enabled: true,
      proxies: ['节点选择', 'DIRECT'],
      useAll: false,
    })
  }

  const saveEditingGroup = () => {
    if (!editingGroup) return
    if (!editingGroup.name.trim()) {
      toast.error('请输入代理组名称')
      return
    }

    const existingIndex = template.proxyGroups.findIndex(g => g.name === editingGroup.name)
    let newGroups: ProxyGroup[]
    
    if (existingIndex >= 0) {
      newGroups = [...template.proxyGroups]
      newGroups[existingIndex] = editingGroup
    } else {
      newGroups = [...template.proxyGroups, editingGroup]
    }

    saveGroups(newGroups)
    setEditingGroup(null)
  }

  // 拖拽处理函数
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', index.toString())
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverIndex(index)
  }

  const handleDragLeave = () => {
    setDragOverIndex(null)
  }

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault()
    const dragIndex = parseInt(e.dataTransfer.getData('text/plain'))
    
    if (dragIndex === dropIndex) {
      setDraggedIndex(null)
      setDragOverIndex(null)
      return
    }

    // 重新排序
    const newGroups = [...template.proxyGroups]
    const [draggedItem] = newGroups.splice(dragIndex, 1)
    newGroups.splice(dropIndex, 0, draggedItem)
    
    saveGroups(newGroups)
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          配置代理分组，拖拽可调整顺序，生成配置时按此顺序排列
        </p>
        <button
          onClick={addGroup}
          className="inline-flex items-center px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="w-4 h-4 mr-2" />
          添加分组
        </button>
      </div>

      <div className="space-y-2">
        {template.proxyGroups.map((group, index) => {
          const isExpanded = expandedGroups.has(group.name)
          const isEnabled = group.enabled !== false // 默认启用
          const isDragging = draggedIndex === index
          const isDragOver = dragOverIndex === index

          return (
            <div
              key={group.name}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              className={`rounded-xl border bg-card overflow-hidden transition-all ${
                !isEnabled ? 'opacity-50' : ''
              } ${isDragging ? 'opacity-50 scale-[0.98]' : ''} ${
                isDragOver ? 'border-primary border-2' : 'border-border'
              }`}
            >
              <div
                className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/50"
                onClick={() => {
                  setExpandedGroups(prev => {
                    const next = new Set(prev)
                    if (next.has(group.name)) next.delete(group.name)
                    else next.add(group.name)
                    return next
                  })
                }}
              >
                {/* 拖拽手柄 */}
                <div 
                  className="cursor-grab active:cursor-grabbing p-1 -ml-1 hover:bg-muted rounded"
                  onClick={(e) => e.stopPropagation()}
                >
                  <GripVertical className="w-4 h-4 text-muted-foreground" />
                </div>

                {/* 启用开关 */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    const newGroups = template.proxyGroups.map(g => 
                      g.name === group.name ? { ...g, enabled: !isEnabled } : g
                    )
                    saveGroups(newGroups)
                  }}
                  className={`w-10 h-5 rounded-full transition-colors relative ${
                    isEnabled ? 'bg-primary' : 'bg-muted'
                  }`}
                  title={isEnabled ? '点击禁用' : '点击启用'}
                >
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${
                    isEnabled ? 'left-5' : 'left-0.5'
                  }`} />
                </button>
                
                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  {(() => {
                    const IconComponent = getIcon(group.icon)
                    return <IconComponent className="w-4 h-4 text-primary" />
                  })()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{group.name}</div>
                  <div className="text-sm text-muted-foreground truncate">
                    {group.description || `${group.type}`}
                  </div>
                </div>
                <span className="text-xs px-2 py-1 rounded bg-muted">{group.type}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); setEditingGroup({ ...group }) }}
                  className="p-2 rounded-lg hover:bg-muted"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteGroup(group.name) }}
                  className="p-2 rounded-lg hover:bg-destructive/10 text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {isExpanded && (
                <div className="px-4 pb-4 border-t border-border bg-muted/30">
                  <div className="mt-3 text-sm space-y-1">
                    {group.filter && (
                      <p><span className="text-muted-foreground">过滤器：</span>
                        <code className="ml-1 px-1 py-0.5 bg-muted rounded text-xs">{group.filter}</code>
                      </p>
                    )}
                    <p><span className="text-muted-foreground">节点来源：</span>
                      {group.useAll ? (
                        <span className="ml-1 text-primary">全部订阅节点</span>
                      ) : (
                        <span className="ml-1">{group.proxies.join(' → ')}</span>
                      )}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* 编辑对话框 */}
      {editingGroup && (
        <EditGroupDialog
          group={editingGroup}
          onChange={setEditingGroup}
          onSave={saveEditingGroup}
          onCancel={() => setEditingGroup(null)}
          isNew={!template.proxyGroups.some(g => g.name === editingGroup.name)}
        />
      )}
    </div>
  )
}

// 规则管理 Tab
function RulesTab({ 
  template, 
  setTemplate 
}: { 
  template: ConfigTemplate
  setTemplate: (t: ConfigTemplate) => void 
}) {
  const [editingRule, setEditingRule] = useState<{ rule: Rule; index?: number } | null>(null)

  const saveRules = async (rules: Rule[]) => {
    try {
      await api.put('/proxy/template/rules', rules)
      setTemplate({ ...template, rules })
      toast.success('保存成功')
    } catch (e: any) {
      toast.error(e.message || '保存失败')
    }
  }

  const deleteRule = (index: number) => {
    const newRules = [...template.rules]
    newRules.splice(index, 1)
    saveRules(newRules)
  }

  const addRule = () => {
    setEditingRule({
      rule: {
        type: 'DOMAIN-SUFFIX',
        payload: '',
        proxy: '🚀 节点选择',
        noResolve: false,
        description: '',
      }
    })
  }

  const saveEditingRule = () => {
    if (!editingRule) return
    const { rule, index } = editingRule
    
    if (!rule.payload && rule.type !== 'MATCH') {
      toast.error('请输入规则内容')
      return
    }

    let newRules: Rule[]
    if (index !== undefined) {
      newRules = [...template.rules]
      newRules[index] = rule
    } else {
      const matchIndex = template.rules.findIndex(r => r.type === 'MATCH')
      newRules = [...template.rules]
      if (matchIndex >= 0) {
        newRules.splice(matchIndex, 0, rule)
      } else {
        newRules.push(rule)
      }
    }

    saveRules(newRules)
    setEditingRule(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          配置分流规则，决定流量走向哪个代理组
        </p>
        <button
          onClick={addRule}
          className="inline-flex items-center px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="w-4 h-4 mr-2" />
          添加规则
        </button>
      </div>

      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="px-4 py-3 text-left font-medium w-32">类型</th>
              <th className="px-4 py-3 text-left font-medium">内容</th>
              <th className="px-4 py-3 text-left font-medium w-40">代理组</th>
              <th className="px-4 py-3 text-left font-medium">说明</th>
              <th className="px-4 py-3 text-center font-medium w-20">操作</th>
            </tr>
          </thead>
          <tbody>
            {template.rules.map((rule, index) => (
              <tr key={index} className="border-t border-border hover:bg-muted/50">
                <td className="px-4 py-2.5">
                  <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-xs font-medium">
                    {rule.type}
                  </span>
                </td>
                <td className="px-4 py-2.5 font-mono text-xs">{rule.payload || '-'}</td>
                <td className="px-4 py-2.5 text-sm">{rule.proxy}</td>
                <td className="px-4 py-2.5 text-muted-foreground text-sm">{rule.description}</td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center justify-center gap-1">
                    <button
                      onClick={() => setEditingRule({ rule: { ...rule }, index })}
                      className="p-1.5 rounded hover:bg-muted"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => deleteRule(index)}
                      className="p-1.5 rounded hover:bg-destructive/10 text-destructive"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 编辑对话框 */}
      {editingRule && (
        <EditRuleDialog
          rule={editingRule.rule}
          proxyGroups={template.proxyGroups}
          onChange={(rule) => setEditingRule({ ...editingRule, rule })}
          onSave={saveEditingRule}
          onCancel={() => setEditingRule(null)}
          isNew={editingRule.index === undefined}
        />
      )}
    </div>
  )
}

// 规则集 Tab
function ProvidersTab({ template }: { template: ConfigTemplate }) {
  const { t } = useTranslation()
  
  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url)
    toast.success(t('common.copied'))
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        规则集从远程 URL 自动下载更新，包含大量预定义规则
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {template.ruleProviders.map((provider) => (
          <div
            key={provider.name}
            className="rounded-lg border border-border p-4 hover:border-primary/50 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-primary" />
                <span className="font-medium">{provider.name}</span>
              </div>
              <span className="text-xs px-2 py-0.5 rounded bg-muted">{provider.behavior}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-2">{provider.description}</p>
            <div 
              className="text-xs text-muted-foreground font-mono mt-2 p-2 bg-muted/50 rounded cursor-pointer hover:bg-muted break-all"
              onClick={() => copyUrl(provider.url)}
              title="点击复制 URL"
            >
              {provider.url}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// 预览 Tab
function PreviewTab({ template }: { template: ConfigTemplate }) {
  const generatePreview = () => {
    // 只包含启用的分组
    const enabledGroups = template.proxyGroups.filter(g => g.enabled !== false)
    const groups = enabledGroups.map(g => ({
      name: g.name,
      type: g.type,
      proxies: g.useAll ? ['...所有节点...'] : g.proxies,
      ...(g.url && { url: g.url }),
      ...(g.interval && { interval: g.interval }),
      ...(g.filter && { filter: g.filter }),
    }))

    const rules = template.rules.map(r => {
      let rule = `${r.type}`
      if (r.payload) rule += `,${r.payload}`
      rule += `,${r.proxy}`
      if (r.noResolve) rule += ',no-resolve'
      return rule
    })

    return `# P-BOX 生成的 Mihomo 配置
# 代理组: ${enabledGroups.length} 个 (${template.proxyGroups.length - enabledGroups.length} 个已禁用)
# 规则: ${template.rules.length} 条
# 规则集: ${template.ruleProviders.length} 个

proxy-groups:
${groups.map(g => `  - name: "${g.name}"
    type: ${g.type}
    proxies: [${g.proxies.map(p => `"${p}"`).join(', ')}]${g.filter ? `\n    filter: "${g.filter}"` : ''}`).join('\n')}

rules:
${rules.map(r => `  - ${r}`).join('\n')}`
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">配置预览（仅展示代理组和规则部分）</p>
        <button
          onClick={() => {
            navigator.clipboard.writeText(generatePreview())
            toast.success('已复制到剪贴板')
          }}
          className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm hover:bg-muted"
        >
          <Download className="w-4 h-4 mr-2" />
          复制
        </button>
      </div>
      <pre className="p-4 rounded-xl bg-muted/50 border border-border overflow-auto text-sm font-mono max-h-[500px]">
        {generatePreview()}
      </pre>
    </div>
  )
}

// 编辑代理组对话框
function EditGroupDialog({
  group,
  onChange,
  onSave,
  onCancel,
  isNew,
}: {
  group: ProxyGroup
  onChange: (g: ProxyGroup) => void
  onSave: () => void
  onCancel: () => void
  isNew: boolean
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card rounded-xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto">
        <h3 className="text-lg font-semibold mb-4">{isNew ? '添加' : '编辑'}代理组</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">名称 *</label>
            <input
              type="text"
              value={group.name}
              onChange={(e) => onChange({ ...group, name: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background"
              placeholder="例如：🚀 节点选择"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">类型</label>
            <select
              value={group.type}
              onChange={(e) => onChange({ ...group, type: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background"
            >
              <option value="select">select - 手动选择</option>
              <option value="url-test">url-test - 自动测速选优</option>
              <option value="fallback">fallback - 故障转移</option>
              <option value="load-balance">load-balance - 负载均衡</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">说明</label>
            <input
              type="text"
              value={group.description}
              onChange={(e) => onChange({ ...group, description: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background"
              placeholder="描述这个分组的用途"
            />
          </div>

          {(group.type === 'url-test' || group.type === 'fallback') && (
            <div>
              <label className="block text-sm font-medium mb-1">节点过滤正则</label>
              <input
                type="text"
                value={group.filter || ''}
                onChange={(e) => onChange({ ...group, filter: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background font-mono text-sm"
                placeholder="(?i)港|HK|Hong"
              />
              <p className="text-xs text-muted-foreground mt-1">匹配节点名称的正则表达式</p>
            </div>
          )}

          <div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={group.useAll || false}
                onChange={(e) => onChange({ ...group, useAll: e.target.checked })}
                className="rounded"
              />
              <span>使用全部订阅节点</span>
            </label>
          </div>

          {!group.useAll && (
            <div>
              <label className="block text-sm font-medium mb-1">代理列表（每行一个）</label>
              
              {/* 快捷添加按钮 */}
              <div className="flex flex-wrap gap-1.5 mb-2">
                <span className="text-xs text-muted-foreground mr-1">快捷添加:</span>
                {[
                  { label: 'DIRECT', value: 'DIRECT', color: 'bg-green-500/10 text-green-600' },
                  { label: 'REJECT', value: 'REJECT', color: 'bg-red-500/10 text-red-600' },
                  { label: '节点选择', value: '节点选择', color: 'bg-blue-500/10 text-blue-600' },
                  { label: '自动选择', value: '自动选择', color: 'bg-purple-500/10 text-purple-600' },
                  { label: '故障转移', value: '故障转移', color: 'bg-orange-500/10 text-orange-600' },
                  { label: '香港节点', value: '香港节点', color: 'bg-muted' },
                  { label: '台湾节点', value: '台湾节点', color: 'bg-muted' },
                  { label: '日本节点', value: '日本节点', color: 'bg-muted' },
                  { label: '美国节点', value: '美国节点', color: 'bg-muted' },
                  { label: '新加坡节点', value: '新加坡节点', color: 'bg-muted' },
                  { label: '手动节点', value: '手动节点', color: 'bg-cyan-500/10 text-cyan-600' },
                ].map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => {
                      if (!group.proxies.includes(item.value)) {
                        onChange({ ...group, proxies: [...group.proxies, item.value] })
                      }
                    }}
                    disabled={group.proxies.includes(item.value)}
                    className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${item.color} ${
                      group.proxies.includes(item.value) ? 'opacity-40 cursor-not-allowed' : 'hover:opacity-80'
                    }`}
                  >
                    + {item.label}
                  </button>
                ))}
              </div>

              <textarea
                value={group.proxies.join('\n')}
                onChange={(e) => onChange({ 
                  ...group, 
                  proxies: e.target.value.split('\n').filter(p => p.trim()) 
                })}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background h-32 font-mono text-sm"
                placeholder="节点选择&#10;自动选择&#10;DIRECT"
              />
              <p className="text-xs text-muted-foreground mt-1">
                提示：顺序决定默认选中项，第一个为默认
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg hover:bg-muted">
            取消
          </button>
          <button
            onClick={onSave}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Save className="w-4 h-4 inline mr-2" />
            保存
          </button>
        </div>
      </div>
    </div>
  )
}

// 编辑规则对话框
function EditRuleDialog({
  rule,
  proxyGroups,
  onChange,
  onSave,
  onCancel,
  isNew,
}: {
  rule: Rule
  proxyGroups: ProxyGroup[]
  onChange: (r: Rule) => void
  onSave: () => void
  onCancel: () => void
  isNew: boolean
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card rounded-xl p-6 w-full max-w-lg">
        <h3 className="text-lg font-semibold mb-4">{isNew ? '添加' : '编辑'}规则</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">规则类型</label>
            <select
              value={rule.type}
              onChange={(e) => onChange({ ...rule, type: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background"
            >
              <option value="DOMAIN">DOMAIN - 完整域名匹配</option>
              <option value="DOMAIN-SUFFIX">DOMAIN-SUFFIX - 域名后缀</option>
              <option value="DOMAIN-KEYWORD">DOMAIN-KEYWORD - 域名关键字</option>
              <option value="IP-CIDR">IP-CIDR - IP 地址段</option>
              <option value="GEOIP">GEOIP - 地理位置 IP</option>
              <option value="RULE-SET">RULE-SET - 引用规则集</option>
              <option value="MATCH">MATCH - 兜底规则</option>
            </select>
          </div>

          {rule.type !== 'MATCH' && (
            <div>
              <label className="block text-sm font-medium mb-1">规则内容 *</label>
              <textarea
                value={rule.payload}
                onChange={(e) => onChange({ ...rule, payload: e.target.value.split('\n')[0] || '' })}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background h-20 font-mono text-sm resize-none"
                placeholder={
                  rule.type === 'DOMAIN' ? 'www.google.com\n每行一个域名' :
                  rule.type === 'DOMAIN-SUFFIX' ? 'google.com\n域名后缀匹配' :
                  rule.type === 'DOMAIN-KEYWORD' ? 'google\n域名包含关键字' :
                  rule.type === 'IP-CIDR' ? '192.168.0.0/16\nIP 地址段' :
                  rule.type === 'GEOIP' ? 'CN\n国家代码' :
                  rule.type === 'RULE-SET' ? 'google-domain\n规则集名称' : ''
                }
              />
              <p className="text-xs text-muted-foreground mt-1">
                {rule.type === 'DOMAIN' && '完整域名，如 www.google.com'}
                {rule.type === 'DOMAIN-SUFFIX' && '域名后缀，如 google.com 会匹配 *.google.com'}
                {rule.type === 'DOMAIN-KEYWORD' && '域名关键字，如 google 会匹配包含 google 的域名'}
                {rule.type === 'IP-CIDR' && 'IP 地址段，如 192.168.0.0/16'}
                {rule.type === 'GEOIP' && '国家代码，如 CN、US、JP'}
                {rule.type === 'RULE-SET' && '引用已定义的规则集'}
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">目标代理组</label>
            <select
              value={rule.proxy}
              onChange={(e) => onChange({ ...rule, proxy: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background"
            >
              {proxyGroups.map(g => (
                <option key={g.name} value={g.name}>{g.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">说明</label>
            <input
              type="text"
              value={rule.description}
              onChange={(e) => onChange({ ...rule, description: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background"
              placeholder="这条规则的作用"
            />
          </div>

          {(rule.type === 'IP-CIDR' || rule.type === 'GEOIP' || rule.type === 'RULE-SET') && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={rule.noResolve}
                onChange={(e) => onChange({ ...rule, noResolve: e.target.checked })}
                className="rounded"
              />
              <span>no-resolve（不解析域名，用于 IP 规则）</span>
            </label>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg hover:bg-muted">
            取消
          </button>
          <button
            onClick={onSave}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Save className="w-4 h-4 inline mr-2" />
            保存
          </button>
        </div>
      </div>
    </div>
  )
}
