import { buildURL } from './buildURL';

// 默认配置
const defaultConfig = {
  baseURL: '',
  timeout: 10000,
};

// 请求配置接口
interface RequestConfig {
  url: string;
  method?: string;
  headers?: HeadersInit;
  data?: unknown;
  params?: Record<string, string>;
}

// 响应拦截器类型
type RequestInterceptor = (config: RequestConfig) => RequestConfig;
type ResponseInterceptor = (response: unknown) => Promise<unknown>;
type InnerResponseInterceptor = (response: Response) => Promise<unknown>;

class IMClientHttp {
  private baseURL: string;
  private timeout: number;
  private requestInterceptors: RequestInterceptor[] = [];
  private innerResponseInterceptors: InnerResponseInterceptor[] = [];
  private responseInterceptors: ResponseInterceptor[] = [];

  constructor() {
    this.baseURL = defaultConfig.baseURL;
    this.timeout = defaultConfig.timeout;
    this.setupDefaultInterceptors();
  }

  /**
   * 设置默认拦截器
   */
  private setupDefaultInterceptors() {
    // 默认响应拦截器（处理 Response 对象）
    this.innerResponseInterceptors.push(async (response) => {
      const data = await response.json();
      
      if (process.env.NODE_ENV === 'development') {
        console.log('data:=>', data);
        console.log('url:=>', this.baseURL + response.url);
      }

      if (response.ok) {
        return data;
      }

      return Promise.reject(data);
    });
  }

  /**
   * 添加请求拦截器
   */
  addRequestInterceptor(interceptor: RequestInterceptor) {
    this.requestInterceptors.push(interceptor);
  }

  /**
   * 添加响应拦截器
   */
  addResponseInterceptor(interceptor: ResponseInterceptor) {
    this.responseInterceptors.push(interceptor);
  }

  /**
   * 执行请求拦截器
   */
  private applyRequestInterceptors(config: RequestConfig): RequestConfig {
    return this.requestInterceptors.reduce((acc, interceptor) => {
      return interceptor(acc);
    }, config);
  }

  /**
   * 执行响应拦截器
   */
  private async applyResponseInterceptors(response: Response): Promise<unknown> {
    let result: unknown = response;
    
    // 首先执行内部拦截器（处理 Response 对象）
    for (const interceptor of this.innerResponseInterceptors) {
      result = await interceptor(response);
      break; // 只执行第一个内部拦截器
    }
    
    // 然后执行用户自定义拦截器（处理数据对象）
    for (const interceptor of this.responseInterceptors) {
      result = await interceptor(result);
    }
    
    return result;
  }

  /**
   * 创建带超时的 fetch 请求
   */
  private async fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeout: number
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * 构建完整的 URL
   */
  private buildFullURL(url: string, params?: Record<string, string>): string {
    const fullURL = url.startsWith('http') ? url : `${this.baseURL}${url}`;
    
    // 如果提供了 params，添加到 URL 中
    if (params && Object.keys(params).length > 0) {
      const urlObj = new URL(fullURL);
      Object.entries(params).forEach(([key, value]) => {
        urlObj.searchParams.append(key, value);
      });
      return urlObj.toString();
    }
    
    return fullURL;
  }

  /**
   * 通用请求方法
   */
  async request<T = unknown>(config: RequestConfig): Promise<T> {
    // 应用请求拦截器
    const processedConfig = this.applyRequestInterceptors(config);

    // 构建 URL（使用 buildURL 函数添加认证参数）
    const fullURL = this.buildFullURL(
      buildURL(processedConfig.url),
      processedConfig.params
    );

    // 准备请求选项
    const requestOptions: RequestInit = {
      method: processedConfig.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...processedConfig.headers,
      },
    };

    // 添加请求体（如果有 data）
    if (processedConfig.data) {
      requestOptions.body = JSON.stringify(processedConfig.data);
    }

    // 发起请求（带超时）
    const response = await this.fetchWithTimeout(
      fullURL,
      requestOptions,
      this.timeout
    );

    // 应用响应拦截器
    return this.applyResponseInterceptors(response) as Promise<T>;
  }

  /**
   * GET 请求
   */
  get<T = unknown>(url: string, params?: Record<string, string>): Promise<T> {
    return this.request<T>({ url, method: 'GET', params });
  }

  /**
   * POST 请求
   */
  post<T = unknown>(url: string, data?: unknown): Promise<T> {
    return this.request<T>({ url, method: 'POST', data });
  }

  /**
   * PUT 请求
   */
  put<T = unknown>(url: string, data?: unknown): Promise<T> {
    return this.request<T>({ url, method: 'PUT', data });
  }

  /**
   * DELETE 请求
   */
  delete<T = unknown>(url: string): Promise<T> {
    return this.request<T>({ url, method: 'DELETE' });
  }

  /**
   * PATCH 请求
   */
  patch<T = unknown>(url: string, data?: unknown): Promise<T> {
    return this.request<T>({ url, method: 'PATCH', data });
  }
}

// 导出单例实例
export const http = new IMClientHttp();

// 导出类，以便需要时可以创建新实例
export { IMClientHttp };

