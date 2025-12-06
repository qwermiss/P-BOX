import client from './client'

export interface SystemConfig {
  autoStart: boolean
  ipForward: boolean
  bbrEnabled: boolean
  tunOptimized: boolean
}

export const systemApi = {
  // 获取系统配置
  getConfig: () => client.get<SystemConfig>('/system/config'),
  
  // 设置开机自启
  setAutoStart: (enabled: boolean) => client.put('/system/autostart', { enabled }),
  
  // 设置 IP 转发
  setIPForward: (enabled: boolean) => client.put('/system/ipforward', { enabled }),
  
  // 设置 BBR
  setBBR: (enabled: boolean) => client.put('/system/bbr', { enabled }),
  
  // 设置 TUN 优化
  setTUNOptimize: (enabled: boolean) => client.put('/system/tunoptimize', { enabled }),
  
  // 一键优化
  optimizeAll: () => client.post('/system/optimize-all', {}),
}
