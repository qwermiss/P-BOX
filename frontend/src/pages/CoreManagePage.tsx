import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  Cpu,
  Download,
  RefreshCw,
  Check,
  AlertCircle,
  Loader2,
  ExternalLink,
  HardDrive,
} from 'lucide-react'
import { coreApi, fetchLatestVersions } from '@/api/core'

interface CoreInfo {
  name: string
  version: string
  latestVersion: string
  installed: boolean
  downloading: boolean
  path: string
}

export default function CoreManagePage() {
  const { t } = useTranslation()
  const [currentCore, setCurrentCore] = useState<'mihomo' | 'singbox'>('mihomo')
  const [cores, setCores] = useState<Record<string, CoreInfo>>({
    mihomo: {
      name: 'Mihomo',
      version: '',
      latestVersion: '',
      installed: false,
      downloading: false,
      path: 'data/cores/mihomo',
    },
    singbox: {
      name: 'sing-box',
      version: '',
      latestVersion: '',
      installed: false,
      downloading: false,
      path: 'data/cores/sing-box',
    },
  })
  const [checking, setChecking] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({})
  const initializedRef = useRef(false)

  // 加载核心状态
  const loadCoreStatus = async () => {
    try {
      const status = await coreApi.getStatus()
      setCurrentCore(status.currentCore)
      setCores(prev => ({
        mihomo: {
          ...prev.mihomo,
          ...status.cores.mihomo,
          downloading: prev.mihomo.downloading,
        },
        singbox: {
          ...prev.singbox,
          ...status.cores.singbox,
          downloading: prev.singbox.downloading,
        },
      }))
    } catch (e) {
      console.error('Load core status error:', e)
    }
  }

  // 检查最新版本 (从 GitHub API 获取)
  const checkLatestVersion = async () => {
    setChecking(true)
    try {
      const versions = await fetchLatestVersions()
      setCores((prev) => ({
        ...prev,
        mihomo: { ...prev.mihomo, latestVersion: versions.mihomo },
        singbox: { ...prev.singbox, latestVersion: versions.singbox },
      }))
      toast.success('检查更新完成')
    } catch (error) {
      toast.error('Failed to check updates')
    } finally {
      setChecking(false)
    }
  }

  // 下载/更新核心
  const downloadCore = async (coreType: string) => {
    setCores((prev) => ({
      ...prev,
      [coreType]: { ...prev[coreType], downloading: true },
    }))
    setDownloadProgress(prev => ({ ...prev, [coreType]: 0 }))

    try {
      // 发起下载请求（后端异步处理）
      await coreApi.downloadCore(coreType)
      
      // 轮询等待下载完成
      const waitForComplete = (): Promise<void> => {
        return new Promise((resolve, reject) => {
          const checkProgress = async () => {
            try {
              const progress = await coreApi.getDownloadProgress(coreType)
              setDownloadProgress(prev => ({ ...prev, [coreType]: progress.progress }))
              
              if (!progress.downloading) {
                if (progress.error) {
                  reject(new Error(progress.error))
                } else {
                  resolve()
                }
                return
              }
              
              // 继续轮询
              setTimeout(checkProgress, 300)
            } catch (e) {
              // 继续轮询
              setTimeout(checkProgress, 300)
            }
          }
          checkProgress()
        })
      }

      await waitForComplete()
      
      // 下载完成，刷新状态
      await loadCoreStatus()
      toast.success(`${cores[coreType].name} 下载完成`)
      
    } catch (e: any) {
      toast.error(e.message || '下载失败')
    } finally {
      setCores((prev) => ({
        ...prev,
        [coreType]: { ...prev[coreType], downloading: false },
      }))
    }
  }

  // 切换核心
  const switchCore = async (coreType: 'mihomo' | 'singbox') => {
    if (!cores[coreType].installed) {
      toast.error(t('core.notInstalled'))
      return
    }
    try {
      await coreApi.switchCore(coreType)
      setCurrentCore(coreType)
      toast.success(`Switched to ${cores[coreType].name}`)
    } catch (e: any) {
      toast.error(e.message || '切换失败')
    }
  }

  useEffect(() => {
    // 防止 StrictMode 导致重复执行
    if (initializedRef.current) return
    initializedRef.current = true
    
    loadCoreStatus()
    checkLatestVersion()
  }, [])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <button
          onClick={checkLatestVersion}
          disabled={checking}
          className="inline-flex items-center px-4 py-2 rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${checking ? 'animate-spin' : ''}`} />
          {t('core.checkUpdate')}
        </button>
      </div>

      {/* 当前核心状态 */}
      <div className="rounded-xl border border-border bg-gradient-to-r from-primary/5 to-primary/10 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-primary/20 flex items-center justify-center">
              <HardDrive className="w-7 h-7 text-primary" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground">{t('core.currentCore')}</div>
              <div className="text-xl font-bold">{cores[currentCore].name}</div>
              <div className="text-sm text-muted-foreground">
                {cores[currentCore].version ? `v${cores[currentCore].version}` : '未安装'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-success/10 text-success">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span className="text-sm font-medium">{t('core.active')}</span>
          </div>
        </div>
      </div>

      {/* 核心列表 */}
      <div className="grid gap-4">
        <CoreCard
          core={cores.mihomo}
          coreType="mihomo"
          isActive={currentCore === 'mihomo'}
          checking={checking}
          progress={downloadProgress.mihomo || 0}
          onSwitch={() => switchCore('mihomo')}
          onDownload={() => downloadCore('mihomo')}
          t={t}
        />
        <CoreCard
          core={cores.singbox}
          coreType="singbox"
          isActive={currentCore === 'singbox'}
          checking={checking}
          progress={downloadProgress.singbox || 0}
          onSwitch={() => switchCore('singbox')}
          onDownload={() => downloadCore('singbox')}
          t={t}
        />
      </div>

      {/* 说明 */}
      <div className="rounded-xl border border-border bg-muted/30 p-4">
        <h3 className="font-medium mb-2">{t('core.about')}</h3>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>• <strong>Mihomo</strong> - {t('core.mihomoDesc')}</li>
          <li>• <strong>sing-box</strong> - {t('core.singboxDesc')}</li>
        </ul>
      </div>
    </div>
  )
}

interface CoreCardProps {
  core: CoreInfo
  coreType: string
  isActive: boolean
  checking: boolean
  progress: number
  onSwitch: () => void
  onDownload: () => void
  t: (key: string) => string
}

function CoreCard({ core, coreType, isActive, checking, progress, onSwitch, onDownload, t }: CoreCardProps) {
  const hasUpdate = core.installed && core.latestVersion && core.version !== core.latestVersion
  const canInstall = !core.installed && core.latestVersion

  return (
    <div
      className={`rounded-xl border p-5 transition-all ${
        isActive
          ? 'border-primary bg-primary/5'
          : 'border-border bg-card hover:border-primary/50'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              isActive ? 'bg-primary/20' : 'bg-muted'
            }`}
          >
            <Cpu className={`w-6 h-6 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-lg">{core.name}</span>
              {isActive && (
                <span className="px-2 py-0.5 rounded text-xs bg-primary/10 text-primary">
                  {t('core.inUse')}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 text-sm">
              {core.installed ? (
                <>
                  <span className="text-muted-foreground">
                    {t('core.installed')}: v{core.version}
                  </span>
                  {hasUpdate && (
                    <span className="flex items-center gap-1 text-warning">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {t('core.updateAvailable')}: v{core.latestVersion}
                    </span>
                  )}
                </>
              ) : (
                <span className="text-muted-foreground">
                  {core.latestVersion ? `${t('core.notInstalled')} (最新: v${core.latestVersion})` : t('core.notInstalled')}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* 下载/更新按钮 */}
          {(canInstall || hasUpdate) && (
            <button
              onClick={onDownload}
              disabled={core.downloading || checking}
              className={`inline-flex items-center px-4 py-2 rounded-lg transition-colors disabled:opacity-50 ${
                hasUpdate
                  ? 'bg-warning text-warning-foreground hover:bg-warning/90'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90'
              }`}
            >
              {core.downloading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t('core.downloading')}
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  {hasUpdate ? t('core.update') : t('core.download')}
                </>
              )}
            </button>
          )}

          {/* 切换按钮 */}
          {core.installed && !isActive && (
            <button
              onClick={onSwitch}
              className="inline-flex items-center px-4 py-2 rounded-lg border border-border hover:bg-muted transition-colors"
            >
              <Check className="w-4 h-4 mr-2" />
              {t('core.switch')}
            </button>
          )}

          {/* GitHub 链接 */}
          <a
            href={
              coreType === 'mihomo'
                ? 'https://github.com/MetaCubeX/mihomo/releases'
                : 'https://github.com/SagerNet/sing-box/releases'
            }
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <ExternalLink className="w-4 h-4 text-muted-foreground" />
          </a>
        </div>
      </div>

      {/* 下载进度条 */}
      {core.downloading && (
        <div className="mt-4">
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-muted-foreground">{t('core.downloadingProgress')}</span>
            <span className="font-medium">{Math.round(progress)}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
