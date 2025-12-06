// Mihomo API 客户端 - 通过后端代理与核心 API 通信

// 使用后端代理 (避免 CORS 问题)
const getProxyApiBase = () => '/api/proxy/mihomo'

// 直接访问 Mihomo API (仅用于 WebSocket)
const getDirectApiBase = () => {
  const host = window.location.hostname || '127.0.0.1'
  return `http://${host}:9090`
}

export interface ProxyNode {
  name: string
  type: string
  now?: string
  all?: string[]
  history?: { delay: number }[]
}

export interface ProxyGroup {
  name: string
  type: string
  now?: string
  all?: string[]
}

export interface MihomoConfig {
  mode: string
  'mixed-port': number
  'allow-lan': boolean
}

export const mihomoApi = {
  // 检查核心是否运行 (通过后端 API)
  async isRunning(): Promise<boolean> {
    try {
      const res = await fetch(`${getProxyApiBase()}/proxies`, { 
        signal: AbortSignal.timeout(2000) 
      })
      return res.ok
    } catch {
      return false
    }
  },

  // 获取版本 (通过后端)
  async getVersion(): Promise<string> {
    const res = await fetch(`${getDirectApiBase()}/version`)
    const data = await res.json()
    return data.version
  },

  // 获取配置
  async getConfigs(): Promise<MihomoConfig> {
    const res = await fetch(`${getDirectApiBase()}/configs`)
    return res.json()
  },

  // 更新配置
  async patchConfigs(config: Partial<MihomoConfig>): Promise<void> {
    await fetch(`${getDirectApiBase()}/configs`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    })
  },

  // 获取所有代理 (通过后端代理)
  async getProxies(): Promise<Record<string, ProxyNode>> {
    const res = await fetch(`${getProxyApiBase()}/proxies`)
    const data = await res.json()
    return data.proxies
  },

  // 获取单个代理组 (通过后端代理)
  async getProxy(name: string): Promise<ProxyGroup> {
    const res = await fetch(`${getProxyApiBase()}/proxies/${encodeURIComponent(name)}`)
    return res.json()
  },

  // 切换节点 (通过后端代理)
  async selectProxy(group: string, name: string): Promise<void> {
    const res = await fetch(`${getProxyApiBase()}/proxies/${encodeURIComponent(group)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    if (!res.ok) {
      throw new Error(`切换失败: ${res.statusText}`)
    }
  },

  // 测试节点延迟 (通过后端代理)
  async testDelay(name: string, url = 'http://www.gstatic.com/generate_204', timeout = 5000): Promise<number> {
    try {
      const res = await fetch(
        `${getProxyApiBase()}/proxies/${encodeURIComponent(name)}/delay?url=${encodeURIComponent(url)}&timeout=${timeout}`
      )
      if (!res.ok) {
        return 0 // 请求失败
      }
      const data = await res.json()
      return data.delay || 0
    } catch {
      return 0 // 超时或网络错误
    }
  },

  // 获取连接 (直接访问，可能有 CORS 问题)
  async getConnections(): Promise<{ downloadTotal: number; uploadTotal: number; connections: any[] }> {
    const res = await fetch(`${getDirectApiBase()}/connections`)
    return res.json()
  },

  // 关闭所有连接
  async closeAllConnections(): Promise<void> {
    await fetch(`${getDirectApiBase()}/connections`, { method: 'DELETE' })
  },

  // 关闭单个连接
  async closeConnection(id: string): Promise<void> {
    await fetch(`${getDirectApiBase()}/connections/${id}`, { method: 'DELETE' })
  },

  // 连接实时更新 WebSocket (通过后端 WebSocket 代理)
  createConnectionsWs(onMessage: (data: any) => void): WebSocket {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    const ws = new WebSocket(`${protocol}//${host}/ws/connections`)
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        onMessage(data)
      } catch {}
    }
    return ws
  },

  // 获取流量统计 (通过后端 WebSocket 代理)
  createTrafficWs(onMessage: (data: { up: number; down: number }) => void): WebSocket {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    const ws = new WebSocket(`${protocol}//${host}/ws/traffic`)
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        onMessage(data)
      } catch {}
    }
    return ws
  },
}
