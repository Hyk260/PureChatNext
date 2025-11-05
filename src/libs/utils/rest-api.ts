import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosError,
} from "axios";
import { buildURL } from "./buildURL";

// https://cloud.tencent.com/document/product/269/1519
const defaultConfig = {
  baseURL: process.env.IM_SERVER_BASE_URL || "https://console.tim.qq.com",
  // 请求超时时间
  timeout: parseInt(process.env.IM_REQUEST_TIMEOUT || "10000", 10),
};

// 响应数据接口
interface IMResponse<T = unknown> {
  ActionStatus: string;
  ErrorCode: number;
  ErrorInfo: string;
  ResultItem?: T;
  data?: T;
}

interface IMErrorResponse {
  ActionStatus: string
  ErrorCode: number
  ErrorInfo: string
}

class IMServerHttp {
  service: AxiosInstance;

  constructor() {
    this.service = axios.create({ ...defaultConfig });
    this.httpInterceptorsRequest();
    this.httpInterceptorsResponse();
  }

  /** 请求拦截 */
  httpInterceptorsRequest() {
    this.service.interceptors.request.use(
      (config) => {
        return config;
      },
      (error: AxiosError) => {
        Promise.reject(error);
      }
    );
  }

  /** 响应拦截 */
  httpInterceptorsResponse() {
    this.service.interceptors.response.use(
      (response) => {
        const { data, status } = response;
        if (status === 200) {
          return data;
        }
        return Promise.reject(data); // 处理非200状态
      },
      (error: AxiosError<IMErrorResponse>) => {
        Promise.reject(error);
      }
    );
  }

  /**
   * 通用请求方法
   */
  async request<T = unknown>(
    config: AxiosRequestConfig
  ): Promise<IMResponse<T>> {
    return this.service.request({
      ...config,
      url: buildURL(config.url || ""),
    });
  }
}

export const http = new IMServerHttp();
