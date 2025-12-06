import axios, { AxiosResponse, AxiosError, InternalAxiosRequestConfig } from 'axios'

const client = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// 请求拦截器 - 添加 token
client.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('p-box-token')
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// 响应拦截器
client.interceptors.response.use(
  (response: AxiosResponse) => {
    const data = response.data
    // 检查业务状态码
    if (data && data.code !== undefined && data.code !== 0) {
      const error = new Error(data.message || '请求失败')
      return Promise.reject(error)
    }
    // 返回 data.data 或 data
    return data?.data !== undefined ? data.data : data
  },
  (error: AxiosError) => {
    // 401 未授权 - 跳转登录
    if (error.response?.status === 401) {
      localStorage.removeItem('p-box-token')
      localStorage.removeItem('p-box-user')
      // 只在非登录页面跳转
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login'
      }
      return Promise.reject(new Error('未授权，请先登录'))
    }

    // 网络错误或服务器错误
    let message = '网络请求失败'
    if (error.response) {
      const data = error.response.data as any
      message = data?.error || data?.message || `服务器错误 (${error.response.status})`
    } else if (error.code === 'ECONNABORTED') {
      message = '请求超时'
    } else if (!navigator.onLine) {
      message = '网络连接已断开'
    }
    return Promise.reject(new Error(message))
  }
)

// 封装请求方法，确保类型正确
export const api = {
  get: <T>(url: string, config?: any): Promise<T> => 
    client.get(url, config) as Promise<T>,
  post: <T>(url: string, data?: any, config?: any): Promise<T> => 
    client.post(url, data, config) as Promise<T>,
  put: <T>(url: string, data?: any, config?: any): Promise<T> => 
    client.put(url, data, config) as Promise<T>,
  delete: <T>(url: string, config?: any): Promise<T> => 
    client.delete(url, config) as Promise<T>,
}

export default api
