import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// 格式化字节数
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 B'

  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']

  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

// 格式化时长
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60

  if (h > 0) {
    return `${h}h ${m}m`
  }
  if (m > 0) {
    return `${m}m ${s}s`
  }
  return `${s}s`
}

// 格式化延迟
export function formatDelay(delay: number): string {
  if (delay === 0) return '-'
  if (delay < 0) return 'timeout'
  return `${delay}ms`
}

// 获取延迟颜色类名
export function getDelayColor(delay: number): string {
  if (delay <= 0) return 'text-muted-foreground'
  if (delay < 100) return 'text-success'
  if (delay < 300) return 'text-warning'
  return 'text-destructive'
}
