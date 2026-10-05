import { apiRequest } from './client'
import type { SettingsResponse, SetupStatusResponse } from './types'

export const getSetupStatus = () => apiRequest<SetupStatusResponse>('/setup')
export const createSetup = (budgetAmount: number) =>
  apiRequest<SettingsResponse>('/setup', { method: 'POST', body: JSON.stringify({ budgetAmount }) })
