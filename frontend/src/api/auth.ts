import type {
  AuthResponse,
  ChangePasswordInput,
  LoginInput,
  MeResponse,
  ProfileStats,
  RegisterInput,
} from '../types/api.ts'
import { apiGet, apiPost } from './client.ts'

export function registerUser(input: RegisterInput): Promise<AuthResponse> {
  return apiPost<AuthResponse>('/api/auth/register', input)
}

export function loginUser(input: LoginInput): Promise<AuthResponse> {
  return apiPost<AuthResponse>('/api/auth/login', input)
}

export function fetchCurrentUser(): Promise<MeResponse> {
  return apiGet<MeResponse>('/api/auth/me')
}

export function fetchProfileStats(): Promise<{ stats: ProfileStats }> {
  return apiGet<{ stats: ProfileStats }>('/api/auth/stats')
}

export function changePassword(input: ChangePasswordInput): Promise<void> {
  return apiPost<void>('/api/auth/change-password', input)
}
