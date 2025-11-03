export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  message: string;
  user: {
    id: string;
    email: string;
    created_at: string;
    updated_at?: string;
  };
  session?: {
    access_token: string;
    refresh_token: string;
    expires_at: number;
  };
}

export interface ErrorResponse {
  error: string;
}

