import type { Slot, TimetableResponse } from './types'

export async function getTimetable(): Promise<TimetableResponse> {
  const res = await fetch('/api/timetable')
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as Promise<TimetableResponse>
}

export class AdminApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message)
  }
}

async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  // redirect manual: com a sessão SSO expirada o nginx da VPS responde 302 pro
  // auth.bit-lab.tech — um fetch não consegue seguir isso cross-origin. Nesse
  // caso recarrega /admin pra re-autenticar via navegação completa (o gate
  // auth_request roda de novo e devolve o usuário logado pra cá).
  const res = await fetch(path, { ...init, redirect: 'manual' })
  if (res.type === 'opaqueredirect' || res.status === 0) {
    window.location.assign('/admin')
    return new Promise<never>(() => {})
  }
  if (res.status === 204) return undefined as T
  const isJson = res.headers.get('content-type')?.includes('application/json') ?? false
  if (!res.ok) {
    let message = `Erro ${res.status}`
    if (isJson) {
      const body = (await res.json()) as { message?: string }
      if (body.message) message = body.message
    } else if (res.status === 403) {
      message = 'Acesso negado — peça acesso ao app on-air no bit-lab-auth.'
    }
    throw new AdminApiError(message, res.status)
  }
  if (!isJson) {
    window.location.assign('/admin')
    return new Promise<never>(() => {})
  }
  return res.json() as Promise<T>
}

export const adminApi = {
  list: () => adminFetch<{ slots: Slot[] }>('/api/admin/slots').then((r) => r.slots),
  create: (form: FormData) => adminFetch<Slot>('/api/admin/slots', { method: 'POST', body: form }),
  update: (id: number, form: FormData) =>
    adminFetch<Slot>(`/api/admin/slots/${id}`, { method: 'PUT', body: form }),
  remove: (id: number) => adminFetch<void>(`/api/admin/slots/${id}`, { method: 'DELETE' }),
}
