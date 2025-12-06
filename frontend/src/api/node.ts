import { api } from './client'

export interface Node {
  id: string
  name: string
  type: string
  server: string
  serverPort: number
  subscriptionId?: string
  isManual: boolean
  enabled: boolean
  delay: number      // 延迟 ms, 0=超时, -1=未测试
  lastTest: number   // 上次测速时间戳
  config: string
  shareUrl?: string
}

export const nodeApi = {
  // 获取所有节点
  list: () => api.get<Node[]>('/nodes'),

  // 从URL导入节点
  importUrl: (url: string) => 
    api.post<Node>('/nodes/import', { url }),

  // 手动添加节点
  addManual: (data: { name: string; type: string; server: string; port: number; config?: string }) =>
    api.post<Node>('/nodes/manual', data),

  // 删除手动节点
  delete: (id: string) => 
    api.delete(`/nodes/${id}`),

  // 测试单个节点延迟
  testDelay: (nodeId: string, server: string, port: number, timeout?: number) =>
    api.post<{ delay: number }>('/nodes/test', { nodeId, server, port, timeout }),

  // 批量测试延迟
  testDelayBatch: (nodeIds: string[], timeout?: number) =>
    api.post<Record<string, number>>('/nodes/test-batch', { nodeIds, timeout }),

  // 获取分享链接
  getShareUrl: (id: string) =>
    api.get<{ url: string }>(`/nodes/${id}/share`),
}
