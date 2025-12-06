import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { 
  RefreshCw, 
  Check, 
  Zap, 
  Globe, 
  ChevronDown, 
  ChevronRight,
  Loader2,
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
  ChevronsUpDown,
  ChevronsDownUp,
  type LucideIcon,
} from 'lucide-react'
import { mihomoApi } from '@/api/mihomo'
import { api } from '@/api/client'

// 图标映射
const groupIcons: Record<string, LucideIcon> = {
  '自动选择': Zap,
  '故障转移': Shield,
  '节点选择': Rocket,
  '全球直连': Target,
  'AI服务': Bot,
  '国外媒体': Globe,
  'Netflix': Film,
  '电报消息': MessageCircle,
  '谷歌服务': Search,
  '推特消息': Twitter,
  '脸书服务': Facebook,
  '游戏平台': Gamepad2,
  '哔哩哔哩': Tv,
  '微软服务': Globe,
  '苹果服务': Apple,
  'GitHub': Github,
  '广告拦截': Ban,
  '漏网之鱼': Fish,
  '香港节点': Flag,
  '台湾节点': Flag,
  '日本节点': Flag,
  '新加坡节点': Flag,
  '美国节点': Flag,
  '其他节点': Globe,
}

// 预定义的分组顺序
const groupOrder = [
  '自动选择', '故障转移', '节点选择', '全球直连', 'AI服务', '国外媒体', 'Netflix', '电报消息', '谷歌服务', 
  '推特消息', '脸书服务', '游戏平台', '哔哩哔哩', '微软服务', '苹果服务', 'GitHub',
  '广告拦截', '漏网之鱼', '香港节点', '台湾节点', '日本节点', '新加坡节点', '美国节点', '其他节点'
]

const getGroupIcon = (name: string): LucideIcon => {
  return groupIcons[name] || Globe
}

const getGroupOrder = (name: string): number => {
  const index = groupOrder.indexOf(name)
  return index === -1 ? 999 : index
}

interface ProxyGroupData {
  name: string
  type: string
  now: string
  all: string[]
  nodes: {
    name: string
    type: string
    delay?: number
  }[]
}

interface ProxyGroupsProps {
  onNodeChange?: (node: string) => void
}

export default function ProxyGroups({ onNodeChange }: ProxyGroupsProps) {
  const { t } = useTranslation()
  const [groups, setGroups] = useState<ProxyGroupData[]>([])
  const [loading, setLoading] = useState(true)
  const [testingNodes, setTestingNodes] = useState<Set<string>>(new Set())
  const [switchingNode, setSwitchingNode] = useState<string | null>(null)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const initializedRef = useRef(false)

  // 加载代理组
  const loadProxies = useCallback(async () => {
    try {
      // 通过后端 API 检查代理状态（避免 CORS 问题）
      const status = await api.get<{ running: boolean }>('/proxy/status')
      if (!status.running) {
        setGroups([])
        setLoading(false)
        return
      }

      const allProxies = await mihomoApi.getProxies()

      // 提取代理组
      const groupsData: ProxyGroupData[] = []
      
      for (const [name, proxy] of Object.entries(allProxies)) {
        if (proxy.type === 'Selector' || proxy.type === 'URLTest' || proxy.type === 'Fallback') {
          const nodes = (proxy.all || []).map(nodeName => {
            const node = allProxies[nodeName]
            return {
              name: nodeName,
              type: node?.type || 'Unknown',
              delay: node?.history?.[0]?.delay,
            }
          })

          groupsData.push({
            name,
            type: proxy.type,
            now: proxy.now || '',
            all: proxy.all || [],
            nodes,
          })
        }
      }

      // 按预定义顺序排序
      groupsData.sort((a, b) => getGroupOrder(a.name) - getGroupOrder(b.name))

      setGroups(groupsData)
      
      // 默认折叠所有组（首次加载时）
      if (!initializedRef.current && groupsData.length > 0) {
        initializedRef.current = true
        setCollapsedGroups(new Set(groupsData.map(g => g.name)))
      }
    } catch (e) {
      console.error('Load proxies error:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadProxies()
    const timer = setInterval(loadProxies, 10000)
    return () => clearInterval(timer)
  }, [loadProxies])

  // 测试节点延迟
  const testNode = async (nodeName: string) => {
    if (testingNodes.has(nodeName)) return
    
    setTestingNodes(prev => new Set(prev).add(nodeName))
    
    try {
      const delay = await mihomoApi.testDelay(nodeName)
      
      // 更新延迟
      setGroups(prev => prev.map(group => ({
        ...group,
        nodes: group.nodes.map(node => 
          node.name === nodeName ? { ...node, delay } : node
        )
      })))
    } catch {
      // 超时
      setGroups(prev => prev.map(group => ({
        ...group,
        nodes: group.nodes.map(node => 
          node.name === nodeName ? { ...node, delay: 0 } : node
        )
      })))
    } finally {
      setTestingNodes(prev => {
        const next = new Set(prev)
        next.delete(nodeName)
        return next
      })
    }
  }

  // 批量测试
  const testAllNodes = async (groupName: string) => {
    const group = groups.find(g => g.name === groupName)
    if (!group) return

    for (const node of group.nodes) {
      await testNode(node.name)
      await new Promise(r => setTimeout(r, 100))
    }
  }

  // 切换节点
  const selectNode = async (groupName: string, nodeName: string) => {
    const group = groups.find(g => g.name === groupName)
    if (!group || group.now === nodeName) return

    setSwitchingNode(nodeName)
    
    try {
      await mihomoApi.selectProxy(groupName, nodeName)
      
      // 更新本地状态
      setGroups(prev => prev.map(g => 
        g.name === groupName ? { ...g, now: nodeName } : g
      ))

      toast.success(t('proxySwitch.switchedTo', { node: nodeName }))
      onNodeChange?.(nodeName)
    } catch (e: any) {
      toast.error(e.message || t('proxySwitch.switchFailed'))
    } finally {
      setSwitchingNode(null)
    }
  }

  // 切换折叠（手风琴效果：展开一个时关闭其他）
  const toggleCollapse = (groupName: string) => {
    setCollapsedGroups(prev => {
      if (prev.has(groupName)) {
        // 当前是折叠状态，展开它并折叠其他所有
        const allNames = new Set(groups.map(g => g.name))
        allNames.delete(groupName)
        return allNames
      } else {
        // 当前是展开状态，折叠它
        const next = new Set(prev)
        next.add(groupName)
        return next
      }
    })
  }

  // 全部展开
  const expandAll = () => {
    setCollapsedGroups(new Set())
  }

  // 全部收起
  const collapseAll = () => {
    setCollapsedGroups(new Set(groups.map(g => g.name)))
  }

  // 延迟颜色
  const getDelayColor = (delay?: number) => {
    if (delay === undefined) return 'text-muted-foreground'
    if (delay === 0) return 'text-destructive'
    if (delay < 100) return 'text-success'
    if (delay < 300) return 'text-warning'
    return 'text-destructive'
  }

  const getDelayBg = (delay?: number) => {
    if (delay === undefined) return 'bg-muted'
    if (delay === 0) return 'bg-destructive/10'
    if (delay < 100) return 'bg-success/10'
    if (delay < 300) return 'bg-warning/10'
    return 'bg-destructive/10'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (groups.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Globe className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>{t('proxySwitch.coreNotRunning')}</p>
        <p className="text-sm mt-1">{t('proxySwitch.coreNotRunningHint')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 顶部操作栏 */}
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={expandAll}
          className="p-2 rounded-lg hover:bg-muted transition-colors"
          title={t('proxySwitch.expandAll')}
        >
          <ChevronsUpDown className="w-4 h-4" />
        </button>
        <button
          onClick={collapseAll}
          className="p-2 rounded-lg hover:bg-muted transition-colors"
          title={t('proxySwitch.collapseAll')}
        >
          <ChevronsDownUp className="w-4 h-4" />
        </button>
      </div>

      {groups.map(group => (
        <div key={group.name} className="rounded-xl border border-border bg-card overflow-hidden">
          {/* 组头部 */}
          <div 
            className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => toggleCollapse(group.name)}
          >
            <div className="flex items-center gap-3">
              {collapsedGroups.has(group.name) ? (
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-5 h-5 text-muted-foreground" />
              )}
              {/* 图标 */}
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                {(() => {
                  const IconComponent = getGroupIcon(group.name)
                  return <IconComponent className="w-4 h-4 text-primary" />
                })()}
              </div>
              <div>
                <h3 className="font-medium">{t(`proxySwitch.groups.${group.name}`, group.name)}</h3>
                <p className="text-sm text-muted-foreground">
                  {group.type} · {t('proxySwitch.nodeCount', { count: group.nodes.length })} · {t('proxySwitch.current')}: {group.now}
                </p>
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation()
                testAllNodes(group.name)
              }}
              className="p-2 rounded-lg hover:bg-muted transition-colors"
              title={t('proxySwitch.testAll')}
            >
              <Zap className="w-4 h-4" />
            </button>
          </div>

          {/* 节点列表 */}
          {!collapsedGroups.has(group.name) && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 p-4 pt-0">
              {group.nodes.map(node => {
                const isSelected = group.now === node.name
                const isTesting = testingNodes.has(node.name)
                const isSwitching = switchingNode === node.name

                return (
                  <div
                    key={node.name}
                    onClick={() => !isSwitching && selectNode(group.name, node.name)}
                    className={`
                      relative p-3 rounded-lg border cursor-pointer transition-all
                      ${isSelected 
                        ? 'border-primary bg-primary/5' 
                        : 'border-border hover:border-primary/50'
                      }
                    `}
                  >
                    {/* 选中标记 */}
                    {isSelected && (
                      <div className="absolute top-2 right-2">
                        <Check className="w-4 h-4 text-primary" />
                      </div>
                    )}

                    {/* 切换中 */}
                    {isSwitching && (
                      <div className="absolute inset-0 bg-background/50 flex items-center justify-center rounded-lg">
                        <Loader2 className="w-5 h-5 animate-spin" />
                      </div>
                    )}

                    {/* 节点名称 */}
                    <p className="font-medium text-sm truncate pr-6" title={node.name}>
                      {node.name}
                    </p>

                    {/* 底部信息 */}
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-muted-foreground">{node.type}</span>
                      
                      <div className="flex items-center gap-1">
                        {/* 延迟 */}
                        {node.delay !== undefined && (
                          <span className={`text-xs px-1.5 py-0.5 rounded ${getDelayBg(node.delay)} ${getDelayColor(node.delay)}`}>
                            {node.delay === 0 ? '超时' : `${node.delay}ms`}
                          </span>
                        )}

                        {/* 测速按钮 */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            testNode(node.name)
                          }}
                          disabled={isTesting}
                          className="p-1 rounded hover:bg-muted transition-colors disabled:opacity-50"
                        >
                          <RefreshCw className={`w-3 h-3 ${isTesting ? 'animate-spin text-primary' : 'text-muted-foreground'}`} />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
