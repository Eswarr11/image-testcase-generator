export interface User {
  id: number;
  email: string;
  password_hash: string;
  openai_api_key?: string;
  created_at: string;
  last_active: string;
  is_active: boolean;
}

export interface Session {
  id: string;
  user_id: number;
  expires_at: string;
  created_at: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  user?: {
    id: number;
    email: string;
    hasApiKey: boolean;
  };
  sessionId?: string;
}

import { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    email: string;
    hasApiKey: boolean;
  };
  sessionId?: string;
}
