import { apiRequest } from './client'
import type { HomeResponse, IsoDate } from './types'

export const getHome = (asOf: IsoDate) =>
  apiRequest<HomeResponse>(`/home?asOf=${encodeURIComponent(asOf)}`)
