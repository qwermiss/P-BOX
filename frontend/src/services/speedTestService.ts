// 网络测速服务 - 使用 WebSocket 实时推送

import { api } from '@/api/client'

export interface SpeedTestResult {
  id: number
  ping: number
  downloadSpeed: number
  uploadSpeed: number
  source: string
  threads: number
  timestamp: string
}

export interface SpeedTestProgress {
  type: 'progress' | 'complete' | 'error'
  phase?: 'ping' | 'download' | 'upload'
  progress?: number
  value?: number
  unit?: string
  result?: SpeedTestResult
  message?: string
}

// WebSocket 实时测速
export function runSpeedTestWithProgress(
  source: string = 'cloudflare',
  downloadThreads: number = 10,
  uploadThreads: number = 3,
  onProgress: (progress: SpeedTestProgress) => void
): { stop: () => void } {
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const wsHost = window.location.hostname
  const wsPort = '8383' // 后端端口
  const ws = new WebSocket(`${wsProtocol}//${wsHost}:${wsPort}/api/speedtest/ws`)

  ws.onopen = () => {
    // 发送开始测速请求
    ws.send(JSON.stringify({
      action: 'start',
      source,
      downloadThreads,
      uploadThreads,
    }))
  }

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data) as SpeedTestProgress
      onProgress(data)
      
      // 测速完成或出错时关闭连接
      if (data.type === 'complete' || data.type === 'error') {
        ws.close()
      }
    } catch (e) {
      console.error('解析 WebSocket 消息失败:', e)
    }
  }

  ws.onerror = (error) => {
    console.error('WebSocket 错误:', error)
    onProgress({ type: 'error', message: '连接失败' })
  }

  ws.onclose = () => {
    console.log('WebSocket 连接已关闭')
  }

  return {
    stop: () => {
      ws.close()
    }
  }
}

// 运行后端测速（非实时，保留兼容）
export async function runSpeedTest(
  source: string = 'cloudflare',
  downloadThreads: number = 10,
  uploadThreads: number = 3
): Promise<SpeedTestResult> {
  const response = await api.post<SpeedTestResult>('/speedtest/start', {
    source,
    downloadThreads,
    uploadThreads,
  })
  return response
}

// 获取历史记录
export async function getSpeedTestHistory(): Promise<SpeedTestResult[]> {
  const response = await api.get<SpeedTestResult[]>('/speedtest/history')
  return response || []
}

// 删除单条历史
export async function deleteSpeedTestHistory(id: number): Promise<void> {
  await api.delete(`/speedtest/history/${id}`)
}

// 清空历史
export async function clearSpeedTestHistory(): Promise<void> {
  await api.delete('/speedtest/history')
}
