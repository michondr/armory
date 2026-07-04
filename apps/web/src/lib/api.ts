import type { AuthResponse, LoginInput, RegisterInput, UpdateSettingsInput, UserSettings } from '@armory/shared';

const API = import.meta.env.VITE_API_URL ?? '';
const STORAGE_KEY = 'armory.auth';

export type StoredAuth = AuthResponse;

export function loadAuth(): StoredAuth | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? (JSON.parse(raw) as StoredAuth) : null;
}

/** Persist auth + notify listeners (AuthProvider) in this and other tabs. */
export function setAuth(auth: StoredAuth | null): void {
  if (auth) localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
  else localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event('armory-auth'));
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: unknown,
  ) {
    super(message);
  }
}

function request(path: string, options: RequestInit, token?: string): Promise<Response> {
  return fetch(`${API}/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
}

async function tryRefresh(): Promise<StoredAuth | null> {
  const current = loadAuth();
  if (!current) return null;
  const res = await request('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken: current.refreshToken }),
  });
  if (!res.ok) {
    setAuth(null);
    return null;
  }
  const data = (await res.json()) as StoredAuth;
  setAuth(data);
  return data;
}

/** Authenticated fetch with a single refresh-on-401 retry. */
export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  let auth = loadAuth();
  let res = await request(path, options, auth?.accessToken);

  if (res.status === 401 && auth?.refreshToken) {
    auth = await tryRefresh();
    if (auth) res = await request(path, options, auth.accessToken);
  }

  if (!res.ok) {
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      /* no body */
    }
    const message =
      (body as { message?: string } | undefined)?.message ?? res.statusText ?? 'Request failed';
    throw new ApiError(res.status, message, body);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const authApi = {
  register: (input: RegisterInput) =>
    apiFetch<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify(input) }),
  login: (input: LoginInput) =>
    apiFetch<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify(input) }),
  logout: (refreshToken: string) =>
    apiFetch<{ ok: true }>('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }),
};

export const settingsApi = {
  get: () => apiFetch<UserSettings>('/settings'),
  update: (input: UpdateSettingsInput) =>
    apiFetch<UserSettings>('/settings', { method: 'PATCH', body: JSON.stringify(input) }),
};
