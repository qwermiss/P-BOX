import { ReactNode, useState, createContext, useContext } from 'react'
import Sidebar from './Sidebar'
import Header from './Header'

interface LayoutProps {
  children: ReactNode
}

// 侧边栏状态上下文
interface SidebarContextType {
  isOpen: boolean
  toggle: () => void
  close: () => void
}

const SidebarContext = createContext<SidebarContextType>({
  isOpen: false,
  toggle: () => {},
  close: () => {},
})

export const useSidebar = () => useContext(SidebarContext)

export default function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const sidebarContext = {
    isOpen: sidebarOpen,
    toggle: () => setSidebarOpen(!sidebarOpen),
    close: () => setSidebarOpen(false),
  }

  return (
    <SidebarContext.Provider value={sidebarContext}>
      <div className="flex h-screen bg-background">
        {/* 移动端遮罩 */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* 侧边栏 */}
        <Sidebar />

        {/* 主内容区 */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* 头部 */}
          <Header />

          {/* 页面内容 */}
          <main className="flex-1 overflow-auto p-4 lg:p-6">
            <div className="animate-fadeIn">{children}</div>
          </main>
        </div>
      </div>
    </SidebarContext.Provider>
  )
}
