import { apiRequest } from './client'
import type { SettingsResponse, UpdateSettingsRequest } from './types'

export const getSettings = () => apiRequest<SettingsResponse>('/settings')
export const updateSettings = (request: UpdateSettingsRequest) =>
  apiRequest<SettingsResponse>('/settings', { method: 'PUT', body: JSON.stringify(request) })
