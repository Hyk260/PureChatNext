import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios'
import { buildURL } from './buildURL'
import { imEnv } from '@/envs/im'

const { IM_SERVER_BASE_URL, IM_REQUEST_TIMEOUT } = imEnv

// https://cloud.tencent.com/document/product/269/1519
const defaultConfig = {
  baseURL: IM_SERVER_BASE_URL || 'https://console.tim.qq.com',
  timeout: parseInt(IM_REQUEST_TIMEOUT || '10000', 10),
}

interface IMApiResponse {
  ActionStatus: string
  ErrorCode: number
  ErrorInfo: string
  [key: string]: unknown
}

class IMServerHttp {
  private service: AxiosInstance

  constructor() {
    this.service = axios.create(defaultConfig)
    this.setupRequestInterceptor()
    this.setupResponseInterceptor()
  }

  private setupRequestInterceptor() {
    this.service.interceptors.request.use(
      (config) => config,
      (error) => Promise.reject(error)
    )
  }

  private setupResponseInterceptor() {
    this.service.interceptors.response.use(
      (response) => {
        const { data, status } = response
        if (status === 200) {
          return data
        }
        return Promise.reject(data)
      },
      (error) => Promise.reject(error)
    )
  }

  async request<T = IMApiResponse>(config: AxiosRequestConfig): Promise<T> {
    return this.service.request({
      ...config,
      method: 'post',
      url: buildURL(config.url || ''),
    })
  }
}

export const http = new IMServerHttp()
