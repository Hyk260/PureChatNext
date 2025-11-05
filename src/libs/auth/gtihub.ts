import { authEnv } from "@/envs/auth";

export type ClientType = "web" | "app";

interface GitHubUser {
  id: number;
  login: string;
  name?: string;
  email?: string;
  avatar_url?: string;
  [key: string]: unknown;
}

interface OAuthResponse {
  access_token: string;
  token_type: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

interface RequestConfig {
  method: string;
  headers: Record<string, string>;
  url: string;
  body?: string;
}

class GitHubAPIError extends Error {
  constructor(message: string, public status?: number, public code?: string) {
    super(message);
    this.name = "GitHubAPIError";
  }
}

const CONFIG = {
  GITHUB_API_URL: "https://api.github.com",
  GITHUB_OAUTH_URL: "https://github.com/login/oauth/access_token",
} as const;

export const getGitHubSecretKey = (client: ClientType = "web") => {
  const {
    GITHUB_CLIENT_ID: clientId,
    GITHUB_CLIENT_SECRET: clientSecret,
    GITHUB_ELECTRON_ID: clientIdApp,
    GITHUB_ELECTRON_SECRET: clientSecretApp
  } = authEnv;

  const keys = {
    web: { clientId, clientSecret },
    app: { clientId: clientIdApp, clientSecret: clientSecretApp },
  };

  return keys[client];
};

export default class GitHubAPI {
  // 构建认证头部
  private static getAuthHeaders(token?: string): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: "application/json",
      "Content-Type": "application/json",
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    return headers;
  }

  // 处理 HTTP 响应
  private static async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new GitHubAPIError(
        errorData.error_description ||
          errorData.message ||
          `HTTP ${response.status}`,
        response.status,
        errorData.error
      );
    }

    return response.json() as Promise<T>;
  }

  // 获取 OAuth 配置
  private static getOAuthConfig(
    code: string,
    client: ClientType
  ): RequestConfig | null {
    const { clientId, clientSecret } = getGitHubSecretKey(client);

    if (!clientId || !clientSecret) {
      console.error(`GitHub客户端配置无效: ${client}`);
      return null;
    }

    return {
      method: "POST",
      headers: this.getAuthHeaders(),
      url: CONFIG.GITHUB_OAUTH_URL,
      body: JSON.stringify({
        code,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    };
  }

  // 获取用户配置
  private static getUserConfig(token: string): RequestConfig {
    return {
      method: "GET",
      headers: this.getAuthHeaders(token),
      url: `${CONFIG.GITHUB_API_URL}/user`,
    };
  }

  // 统一的请求方法
  private static async makeRequest<T>(config: RequestConfig): Promise<T> {
    const { url, method, headers, body } = config;

    const response = await fetch(url, {
      method,
      headers,
      ...(body && { body }),
    });

    return this.handleResponse<T>(response);
  }

  // 获取访问令牌
  static async getAccessToken(
    code: string,
    client: ClientType
  ): Promise<string> {
    try {
      const config = this.getOAuthConfig(code, client);
      if (!config) return "";

      const data = await this.makeRequest<OAuthResponse>(config);
      return data.access_token || "";
    } catch (error: unknown) {
      this.handleError("获取访问令牌失败", error);
      return "";
    }
  }

  // 获取用户信息
  static async getUser(token: string): Promise<GitHubUser | null> {
    try {
      const config = this.getUserConfig(token);
      return await this.makeRequest<GitHubUser>(config);
    } catch (error: unknown) {
      this.handleError("获取用户信息失败", error);
      return null;
    }
  }

  // 获取授权用户信息
  static async getUserInfo(
    code: string,
    client: ClientType
  ): Promise<GitHubUser | null> {
    const token = await this.getAccessToken(code, client);
    if (!token) return null;

    return this.getUser(token);
  }

  private static handleError(context: string, error: unknown): void {
    if (error instanceof GitHubAPIError) {
      console.error(`${context}:`, {
        message: error.message,
        status: error.status,
        code: error.code,
      });
    } else if (error instanceof Error) {
      console.error(`${context}:`, error.message);
    } else {
      console.error(`${context}:`, "未知错误");
    }
  }

  // 验证令牌有效性
  static async validateToken(token: string): Promise<boolean> {
    try {
      const config = this.getUserConfig(token);
      await this.makeRequest(config);
      return true;
    } catch {
      return false;
    }
  }

  // 批量获取用户信息
  static async getUsersByTokens(
    tokens: string[]
  ): Promise<(GitHubUser | null)[]> {
    const requests = tokens.map((token) => this.getUser(token));
    return Promise.all(requests);
  }
}

export type { GitHubUser, OAuthResponse };
