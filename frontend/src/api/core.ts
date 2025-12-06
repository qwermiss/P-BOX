import axios from 'axios'

const client = axios.create({
  baseURL: '/api',
  timeout: 30000,
})

export interface CoreInfo {
  name: string
  version: string
  latestVersion: string
  installed: boolean
  path: string
}

export interface CoreStatus {
  currentCore: 'mihomo' | 'singbox'
  cores: Record<string, CoreInfo>
}

export interface DownloadProgress {
  downloading: boolean
  progress: number
  speed: number
  error?: string
}

export const coreApi = {
  // 获取核心状态
  getStatus: async (): Promise<CoreStatus> => {
    const res = await client.get('/core/status')
    return res.data.data
  },

  // 获取最新版本
  getLatestVersions: async (): Promise<Record<string, string>> => {
    const res = await client.get('/core/versions')
    return res.data.data
  },

  // 切换核心
  switchCore: async (coreType: string): Promise<void> => {
    await client.post('/core/switch', { coreType })
  },

  // 下载核心
  downloadCore: async (coreType: string): Promise<void> => {
    await client.post(`/core/download/${coreType}`)
  },

  // 获取下载进度
  getDownloadProgress: async (coreType: string): Promise<DownloadProgress> => {
    const res = await client.get(`/core/download/${coreType}/progress`)
    return res.data.data
  },
}

// 从后端获取最新版本
export async function fetchLatestVersions(): Promise<{ mihomo: string; singbox: string }> {
  const versions = await coreApi.getLatestVersions()
  return {
    mihomo: versions.mihomo || '',
    singbox: versions.singbox || '',
  }
}
