import type { HealthResponse } from '../types/api.ts'
import { apiGet } from './client.ts'

export function getHealth(): Promise<HealthResponse> {
  return apiGet<HealthResponse>('/api/health')
}
