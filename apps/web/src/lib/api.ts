import type {
  Ammo,
  AmmoSuggestion,
  AuthResponse,
  Cartridge,
  CreateAmmoInput,
  CreateCartridgeInput,
  CreateGunInput,
  CreatePriceEntryInput,
  CreateSessionInput,
  CreateSetInput,
  CreateTargetInput,
  Gun,
  LoginInput,
  RegisterInput,
  SessionDetail,
  SessionListItem,
  UpdateAmmoInput,
  UpdateGunInput,
  UpdateSessionInput,
  UpdateSettingsInput,
  UpdateTargetInput,
  UserSettings,
} from '@armory/shared';

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

function buildInit(options: RequestInit, token: string | undefined, json: boolean): RequestInit {
  const headers: Record<string, string> = { ...((options.headers as Record<string, string>) ?? {}) };
  if (json) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return { ...options, headers };
}

async function tryRefresh(): Promise<StoredAuth | null> {
  const current = loadAuth();
  if (!current) return null;
  const res = await fetch(`${API}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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

/** Fetch with the current access token + a single refresh-on-401 retry. */
async function authFetch(path: string, options: RequestInit, json: boolean): Promise<Response> {
  let auth = loadAuth();
  let res = await fetch(`${API}/api${path}`, buildInit(options, auth?.accessToken, json));
  if (res.status === 401 && auth?.refreshToken) {
    auth = await tryRefresh();
    if (auth) res = await fetch(`${API}/api${path}`, buildInit(options, auth.accessToken, json));
  }
  return res;
}

async function fail(res: Response): Promise<never> {
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

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await authFetch(path, options, true);
  if (!res.ok) await fail(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Upload a file (multipart) and get back the stored image filename. */
export async function uploadImage(file: File): Promise<{ imagePath: string }> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await authFetch('/images', { method: 'POST', body: fd }, false);
  if (!res.ok) await fail(res);
  return (await res.json()) as { imagePath: string };
}

/** Ask the server to download + store an image from a URL. Returns the stored filename. */
export function uploadImageFromUrl(url: string): Promise<{ imagePath: string }> {
  return apiFetch<{ imagePath: string }>('/images/from-url', {
    method: 'POST',
    body: JSON.stringify({ url }),
  });
}

/** Load a protected image as an object URL (so the <img> request carries auth). */
export async function fetchImageObjectUrl(filename: string): Promise<string> {
  const res = await authFetch(`/images/${encodeURIComponent(filename)}`, {}, false);
  if (!res.ok) await fail(res);
  return URL.createObjectURL(await res.blob());
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

export const gunsApi = {
  list: () => apiFetch<Gun[]>('/guns'),
  get: (id: string) => apiFetch<Gun>(`/guns/${id}`),
  create: (input: CreateGunInput) =>
    apiFetch<Gun>('/guns', { method: 'POST', body: JSON.stringify(input) }),
  update: (id: string, input: UpdateGunInput) =>
    apiFetch<Gun>(`/guns/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  remove: (id: string) => apiFetch<{ ok: true }>(`/guns/${id}`, { method: 'DELETE' }),
};

export const ammoApi = {
  list: (q?: string) => apiFetch<Ammo[]>(`/ammo${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  get: (id: string) => apiFetch<Ammo>(`/ammo/${id}`),
  create: (input: CreateAmmoInput) =>
    apiFetch<Ammo>('/ammo', { method: 'POST', body: JSON.stringify(input) }),
  update: (id: string, input: UpdateAmmoInput) =>
    apiFetch<Ammo>(`/ammo/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  remove: (id: string) => apiFetch<{ ok: true }>(`/ammo/${id}`, { method: 'DELETE' }),
  suggest: (q: string) =>
    apiFetch<AmmoSuggestion[]>(`/ammo/suggest${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  addPrice: (id: string, input: CreatePriceEntryInput) =>
    apiFetch<Ammo>(`/ammo/${id}/prices`, { method: 'POST', body: JSON.stringify(input) }),
  deletePrice: (id: string, entryId: string) =>
    apiFetch<Ammo>(`/ammo/${id}/prices/${entryId}`, { method: 'DELETE' }),
  addImage: (id: string, imagePath: string) =>
    apiFetch<Ammo>(`/ammo/${id}/images`, { method: 'POST', body: JSON.stringify({ imagePath }) }),
  removeImage: (id: string, imageId: string) =>
    apiFetch<Ammo>(`/ammo/${id}/images/${imageId}`, { method: 'DELETE' }),
};

export const sessionsApi = {
  list: (gunId?: string) =>
    apiFetch<SessionListItem[]>(`/sessions${gunId ? `?gunId=${gunId}` : ''}`),
  get: (id: string) => apiFetch<SessionDetail>(`/sessions/${id}`),
  create: (input: CreateSessionInput) =>
    apiFetch<SessionDetail>('/sessions', { method: 'POST', body: JSON.stringify(input) }),
  update: (id: string, input: UpdateSessionInput) =>
    apiFetch<SessionDetail>(`/sessions/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  remove: (id: string) => apiFetch<{ ok: true }>(`/sessions/${id}`, { method: 'DELETE' }),
  addSet: (id: string, input: CreateSetInput) =>
    apiFetch<SessionDetail>(`/sessions/${id}/sets`, { method: 'POST', body: JSON.stringify(input) }),
  removeSet: (id: string, setId: string) =>
    apiFetch<SessionDetail>(`/sessions/${id}/sets/${setId}`, { method: 'DELETE' }),
  addTarget: (id: string, setId: string, input: CreateTargetInput) =>
    apiFetch<SessionDetail>(`/sessions/${id}/sets/${setId}/targets`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  updateTarget: (id: string, setId: string, targetId: string, input: UpdateTargetInput) =>
    apiFetch<SessionDetail>(`/sessions/${id}/sets/${setId}/targets/${targetId}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  removeTarget: (id: string, setId: string, targetId: string) =>
    apiFetch<SessionDetail>(`/sessions/${id}/sets/${setId}/targets/${targetId}`, {
      method: 'DELETE',
    }),
  setShots: (
    id: string,
    setId: string,
    targetId: string,
    input: {
      shots?: { x: number; y: number; ringValue?: number | null; zone?: string | null }[];
      ringValues?: number[];
      zones?: string[];
    },
  ) =>
    apiFetch<SessionDetail>(`/sessions/${id}/sets/${setId}/targets/${targetId}/shots`, {
      method: 'PUT',
      body: JSON.stringify(input),
    }),
};

export const cartridgesApi = {
  list: () => apiFetch<Cartridge[]>('/cartridges'),
  create: (input: CreateCartridgeInput) =>
    apiFetch<Cartridge>('/cartridges', { method: 'POST', body: JSON.stringify(input) }),
  remove: (id: string) => apiFetch<{ ok: true }>(`/cartridges/${id}`, { method: 'DELETE' }),
  addDefaults: () => apiFetch<Cartridge[]>('/cartridges/defaults', { method: 'POST' }),
};
