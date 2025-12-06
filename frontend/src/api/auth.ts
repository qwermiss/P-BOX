import { api } from './client'

export interface AuthConfig {
  enabled: boolean
  username: string
  avatar: string
}

export interface AuthStatus {
  enabled: boolean
  authenticated: boolean
}

export interface LoginResult {
  token: string
  username: string
  avatar: string
}

export const authApi = {
  // 获取认证配置
  getConfig: () => api.get<AuthConfig>('/auth/config'),

  // 检查认证状态
  check: () => api.get<AuthStatus>('/auth/check'),

  // 登录
  login: (username: string, password: string) => 
    api.post<LoginResult>('/auth/login', { username, password }),

  // 登出
  logout: () => api.post('/auth/logout', {}),

  // 设置是否启用认证
  setEnabled: (enabled: boolean) => 
    api.put('/auth/enabled', { enabled }),

  // 更新用户名
  updateUsername: (username: string) => 
    api.put('/auth/username', { username }),

  // 更新密码
  updatePassword: (oldPassword: string, newPassword: string) => 
    api.put('/auth/password', { oldPassword, newPassword }),

  // 更新头像
  updateAvatar: (avatar: string) => 
    api.put('/auth/avatar', { avatar }),
}

// 获取存储的 token
export function getToken(): string | null {
  return localStorage.getItem('p-box-token')
}

// 获取存储的用户信息
export function getUser(): { username: string; avatar: string } | null {
  const user = localStorage.getItem('p-box-user')
  return user ? JSON.parse(user) : null
}

// 清除认证信息
export function clearAuth() {
  localStorage.removeItem('p-box-token')
  localStorage.removeItem('p-box-user')
}

export default authApi
