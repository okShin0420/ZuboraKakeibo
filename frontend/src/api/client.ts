import type { ErrorResponse } from './types'

const baseUrl = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '')

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fieldErrors: Record<string, string>,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
    })
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'サーバーに接続できませんでした。もう一度お試しください。', {})
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null) as ErrorResponse | null
    throw new ApiError(response.status, body?.code ?? 'HTTP_ERROR',
      body?.message ?? '通信中に問題が起きました。もう一度お試しください。', body?.fieldErrors ?? {})
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '通信中に問題が起きました。もう一度お試しください。'
}
