import type { ApiResponse } from "@face-lab/shared";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: "same-origin",
    headers: init?.body
      ? (init.body instanceof FormData ? undefined : { "Content-Type": "application/json" })
      : undefined,
    ...init,
  });
  let body: ApiResponse<T> | null = null;
  try {
    body = (await res.json()) as ApiResponse<T>;
  } catch {
    // resposta sem JSON (ex: 502) — cai no throw abaixo
  }
  if (!res.ok || !body || !body.ok) {
    const msg = body && !body.ok ? body.error : `erro ${res.status}`;
    throw new ApiError(msg, res.status);
  }
  return body.data;
}
