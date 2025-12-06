import client from './client'

// 透明代理模式类型
export type TransparentMode = 'off' | 'tun' | 'tproxy' | 'redirect'

export interface ProxyStatus {
  running: boolean
  coreType: string
  coreVersion: string
  mode: 'rule' | 'global' | 'direct'
  mixedPort: number
  socksPort: number
  allowLan: boolean
  tunEnabled: boolean
  transparentMode: TransparentMode
  uptime: number
}

export interface ProxyConfig {
  mixedPort: number
  socksPort: number
  redirPort: number
  tproxyPort: number
  allowLan: boolean
  ipv6: boolean
  mode: string
  logLevel: string
  tunEnabled: boolean
  tunStack: string
  transparentMode: TransparentMode
}

export const proxyApi = {
  getStatus: () => client.get<ProxyStatus>('/proxy/status'),
  start: () => client.post('/proxy/start'),
  stop: () => client.post('/proxy/stop'),
  restart: () => client.post('/proxy/restart'),
  setMode: (mode: string) => client.put('/proxy/mode', { mode }),
  setTunMode: (enabled: boolean) => client.put('/proxy/tun', { enabled }),
  setTransparentMode: (mode: TransparentMode) => client.put('/proxy/transparent', { mode }),
  getConfig: () => client.get<ProxyConfig>('/proxy/config'),
  updateConfig: (config: ProxyConfig) => client.put('/proxy/config', config),
}
