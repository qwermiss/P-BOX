import { useEffect, useRef, useState } from 'react'
import { motion, useSpring } from 'framer-motion'

interface CyberpunkSpeedometerProps {
  speed: number
  maxSpeed?: number
  ping?: number
  downloadSpeed?: number
  uploadSpeed?: number
  isRunning?: boolean
}

// 格式化速度显示
const formatSpeed = (speedMbps: number): { value: string; unit: string } => {
  if (speedMbps >= 1000) {
    return { value: (speedMbps / 1000).toFixed(2), unit: 'Gbps' }
  }
  return { value: Math.round(speedMbps).toString(), unit: 'Mbps' }
}

export const CyberpunkSpeedometer = ({
  speed,
  maxSpeed = 100,
  ping = 0,
  downloadSpeed = 0,
  uploadSpeed = 0,
  isRunning = false,
}: CyberpunkSpeedometerProps) => {
  const [displaySpeed, setDisplaySpeed] = useState(0)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // 平滑动画
  const springSpeed = useSpring(0, { stiffness: 200, damping: 30, mass: 0.5 })
  const circumference = 2 * Math.PI * 150
  const progress = useSpring(circumference, { stiffness: 200, damping: 30, mass: 0.5 })

  useEffect(() => {
    springSpeed.set(speed)
  }, [speed, springSpeed])

  useEffect(() => {
    const unsubscribe = springSpeed.on('change', (latest: number) => {
      setDisplaySpeed(Math.round(latest))
    })
    return unsubscribe
  }, [springSpeed])

  useEffect(() => {
    progress.set(circumference - (circumference * speed) / maxSpeed)
  }, [speed, maxSpeed, progress, circumference])

  // 六边形旋转动画
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationFrame: number
    let rotation = 0

    const drawHexagon = () => {
      const centerX = 160
      const centerY = 160
      const hexSize = 140

      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.save()
      ctx.translate(centerX, centerY)
      ctx.rotate(rotation)

      const gradient = ctx.createLinearGradient(-hexSize, -hexSize, hexSize, hexSize)
      gradient.addColorStop(0, '#FF00FF')
      gradient.addColorStop(0.5, '#00FFFF')
      gradient.addColorStop(1, '#FFFF00')

      ctx.strokeStyle = gradient
      ctx.lineWidth = 1.5
      ctx.globalAlpha = 0.3
      ctx.beginPath()

      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i
        const x = Math.cos(angle) * hexSize
        const y = Math.sin(angle) * hexSize
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.closePath()
      ctx.stroke()
      ctx.restore()

      rotation += 0.005
      animationFrame = requestAnimationFrame(drawHexagon)
    }

    drawHexagon()
    return () => cancelAnimationFrame(animationFrame)
  }, [])

  // 根据速度计算渐变颜色
  const getSpeedColor = () => {
    const ratio = speed / maxSpeed
    if (ratio < 0.3) return 'from-cyan-400 to-blue-500'
    if (ratio < 0.6) return 'from-purple-400 to-pink-500'
    if (ratio < 0.8) return 'from-pink-500 to-red-500'
    return 'from-red-500 to-yellow-400'
  }

  return (
    <div className="flex flex-col items-center w-full">
      {/* 仪表盘 */}
      <div className="relative flex items-center justify-center w-full aspect-square max-w-[320px] mx-auto">
        {/* 六边形旋转背景 */}
        <canvas
          ref={canvasRef}
          width={320}
          height={320}
          className="absolute inset-0 w-full h-full"
          style={{ opacity: 0.5 }}
        />

        {/* SVG 圆环 */}
        <div className="relative w-full h-full p-5">
          <svg
            className="transform -rotate-90 w-full h-full"
            viewBox="0 0 280 280"
            style={{ filter: 'drop-shadow(0 0 12px rgba(255, 0, 255, 0.5))' }}
          >
            <defs>
              <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#00FFFF" />
                <stop offset="50%" stopColor="#FF00FF" />
                <stop offset="100%" stopColor="#FFFF00" />
              </linearGradient>
            </defs>

            {/* 背景圆环 */}
            <circle
              cx="140"
              cy="140"
              r="120"
              fill="none"
              stroke="rgba(255, 255, 255, 0.1)"
              strokeWidth="20"
            />

            {/* 进度圆环 */}
            <motion.circle
              cx="140"
              cy="140"
              r="120"
              fill="none"
              stroke="url(#ringGradient)"
              strokeWidth="20"
              strokeLinecap="round"
              strokeDasharray={circumference}
              style={{ strokeDashoffset: progress }}
            />
          </svg>

          {/* 中心内容 */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <motion.div
              className={`text-5xl font-black bg-gradient-to-br ${getSpeedColor()} bg-clip-text text-transparent tabular-nums`}
              style={{ filter: 'drop-shadow(0 0 10px rgba(0, 255, 255, 0.5))' }}
              animate={isRunning ? { scale: [1, 1.05, 1] } : {}}
              transition={{ duration: 1, repeat: Infinity }}
            >
              {formatSpeed(displaySpeed).value}
            </motion.div>
            <div className="text-sm text-muted-foreground mt-1">{formatSpeed(displaySpeed).unit}</div>
            <div className="flex items-center gap-1.5 mt-3">
              <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
              <span className="text-yellow-400 text-sm font-semibold">{ping} ms</span>
            </div>
          </div>
        </div>

        {/* 外围发光效果 */}
        {isRunning && (
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(255,0,255,0.15) 0%, transparent 70%)' }}
            animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.5, 0.3] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
      </div>

      {/* 上传/下载速度 */}
      <div className="flex items-center justify-center gap-8 mt-3 w-full">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
          <div className="flex flex-col">
            <span className="text-[10px] text-muted-foreground">下载</span>
            <span className="text-base font-bold text-green-400 tabular-nums">
              {formatSpeed(downloadSpeed).value}
              <span className="text-xs ml-0.5">{formatSpeed(downloadSpeed).unit}</span>
            </span>
          </div>
        </div>
        
        <div className="h-8 w-px bg-border" />
        
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
          </svg>
          <div className="flex flex-col">
            <span className="text-[10px] text-muted-foreground">上传</span>
            <span className="text-base font-bold text-blue-400 tabular-nums">
              {formatSpeed(uploadSpeed).value}
              <span className="text-xs ml-0.5">{formatSpeed(uploadSpeed).unit}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
