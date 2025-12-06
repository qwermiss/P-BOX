import { api } from './client'

export interface Subscription {
  id: string
  name: string
  url: string
  nodeCount: number          // 总节点数
  filteredNodeCount: number  // 过滤后有效节点数
  traffic?: {
    upload: number
    download: number
    total: number
  }
  expireTime?: string
  updatedAt: string
  createdAt: string
  // 定时更新
  autoUpdate: boolean
  updateInterval: number // 秒
  // 关键词过滤
  filterKeywords?: string[]
  filterMode: 'include' | 'exclude'
  // 自定义请求头
  customHeaders?: Record<string, string>
}

export interface SubscriptionNode {
  name: string
  type: string
  server: string
  serverPort: number
  enabled: boolean
  isFiltered: boolean
  ping: number
  country?: string
}

export interface AddSubscriptionRequest {
  name: string
  url: string
  autoUpdate?: boolean
  updateInterval?: number
  filterKeywords?: string[]
  filterMode?: 'include' | 'exclude'
  customHeaders?: Record<string, string>
}

export const subscriptionApi = {
  list: () => api.get<Subscription[]>('/subscriptions'),
  get: (id: string) => api.get<Subscription>(`/subscriptions/${id}`),
  getNodes: (id: string) => api.get<SubscriptionNode[]>(`/subscriptions/${id}/nodes`),
  add: (data: AddSubscriptionRequest) => 
    api.post<Subscription>('/subscriptions', data),
  update: (id: string, data: AddSubscriptionRequest) =>
    api.put(`/subscriptions/${id}`, data),
  delete: (id: string) => api.delete(`/subscriptions/${id}`),
  refresh: (id: string) => api.post(`/subscriptions/${id}/update`),
  refreshAll: () => api.post('/subscriptions/update-all'),
}
