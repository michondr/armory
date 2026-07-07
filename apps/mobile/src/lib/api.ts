import * as SecureStore from 'expo-secure-store';
import NetInfo from '@react-native-community/netinfo';
import type {
  AuthResponse,
  LoginInput,
  RegisterInput,
  SyncPullResponse,
  SyncPushInput,
  SyncPushResponse,
} from '@armory/shared';
import { API_URL } from './config';

const ACCESS_KEY = 'armory.access';
const REFRESH_KEY = 'armory.refresh';
const USER_KEY = 'armory.user';

export interface StoredUser {
  id: string;
  email: string;
  displayName: string | null;
}

let accessToken: string | null = null;
let refreshToken: string | null = null;

/** Load persisted tokens on boot. Returns the stored user if logged in. */
export async function loadSession(): Promise<StoredUser | null> {
  accessToken = await SecureStore.getItemAsync(ACCESS_KEY);
  refreshToken = await SecureStore.getItemAsync(REFRESH_KEY);
  const raw = await SecureStore.getItemAsync(USER_KEY);
  return raw ? (JSON.parse(raw) as StoredUser) : null;
}

async function persist(auth: AuthResponse): Promise<StoredUser> {
  accessToken = auth.accessToken;
  refreshToken = auth.refreshToken;
  const user: StoredUser = {
    id: auth.user.id,
    email: auth.user.email,
    displayName: auth.user.displayName ?? null,
  };
  await SecureStore.setItemAsync(ACCESS_KEY, auth.accessToken);
  await SecureStore.setItemAsync(REFRESH_KEY, auth.refreshToken);
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
  return user;
}

export async function clearSession(): Promise<void> {
  accessToken = null;
  refreshToken = null;
  await SecureStore.deleteItemAsync(ACCESS_KEY);
  await SecureStore.deleteItemAsync(REFRESH_KEY);
  await SecureStore.deleteItemAsync(USER_KEY);
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** True when a request failed because the device is offline (vs. a server error). */
export class OfflineError extends Error {
  constructor() {
    super('offline');
  }
}

/**
 * The device has network connectivity, but the request to the API still failed
 * (DNS/TLS/connection refused/timeout). Surfaced distinctly from `OfflineError`
 * so the diagnostics can tell "on wifi but the server is unreachable" apart
 * from "no network at all" — otherwise a stranded/unreachable server reads as
 * "offline" forever and hides the real cause.
 */
export class ServerUnreachableError extends Error {
  constructor(message: string) {
    super(message);
  }
}

/** Quick connectivity check: can we reach the API's unauthed /health endpoint? */
export interface ConnectionTestResult {
  ok: boolean;
  status?: number;
  message: string;
  ms?: number;
}

export async function testConnection(): Promise<ConnectionTestResult> {
  const start = Date.now();
  try {
    const res = await fetch(`${API_URL}/health`, { method: 'GET' });
    const ms = Date.now() - start;
    if (res.ok) return { ok: true, status: res.status, message: 'reachable', ms };
    return { ok: false, status: res.status, message: `HTTP ${res.status} ${res.statusText}`.trim() };
  } catch (e) {
    const net = await NetInfo.fetch().catch(() => null);
    const connected = net?.isConnected ?? false;
    const detail = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      message: connected ? `online, server unreachable (${detail})` : `no network (${detail})`,
    };
  }
}

async function rawFetch(path: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(`${API_URL}${path}`, init);
  } catch (e) {
    // fetch throws on any network failure. Distinguish true offline (NetInfo says
    // no connectivity) from "online but the server is unreachable" so the sync
    // engine and the diagnostics log report the real cause instead of masking
    // both as "offline".
    const net = await NetInfo.fetch().catch(() => null);
    const connected = net?.isConnected ?? false;
    if (!connected) throw new OfflineError();
    const detail = e instanceof Error ? e.message : String(e);
    throw new ServerUnreachableError(`server unreachable: ${detail}`);
  }
}

async function tryRefresh(): Promise<boolean> {
  if (!refreshToken) return false;
  const res = await rawFetch('/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) {
    await clearSession();
    return false;
  }
  await persist((await res.json()) as AuthResponse);
  return true;
}

/** Authenticated fetch with a single refresh-on-401 retry. */
async function authFetch(path: string, init: RequestInit): Promise<Response> {
  const withAuth = (): RequestInit => ({
    ...init,
    headers: {
      ...(init.headers ?? {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
  });
  let res = await rawFetch(path, withAuth());
  if (res.status === 401 && (await tryRefresh())) {
    res = await rawFetch(path, withAuth());
  }
  return res;
}

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = (await res.json()) as { message?: string };
      if (body?.message) message = body.message;
    } catch {
      /* no body */
    }
    throw new ApiError(res.status, message);
  }
  return (await res.json()) as T;
}

async function apiJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await authFetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  return jsonOrThrow<T>(res);
}

export const authApi = {
  login: async (input: LoginInput): Promise<StoredUser> =>
    persist(await apiJson<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify(input) })),
  register: async (input: RegisterInput): Promise<StoredUser> =>
    persist(
      await apiJson<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify(input) }),
    ),
  logout: async (): Promise<void> => {
    if (refreshToken) {
      try {
        await apiJson('/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken }) });
      } catch {
        /* best effort */
      }
    }
    await clearSession();
  },
};

export const syncApi = {
  pull: (since?: string): Promise<SyncPullResponse> =>
    apiJson<SyncPullResponse>(`/sync/changes${since ? `?since=${encodeURIComponent(since)}` : ''}`),
  push: (input: SyncPushInput): Promise<SyncPushResponse> =>
    apiJson<SyncPushResponse>('/sync/changes', { method: 'POST', body: JSON.stringify(input) }),
};

/** Upload an image file (content-addressed, idempotent). Returns the stored path. */
export async function uploadImage(localUri: string): Promise<string> {
  const form = new FormData();
  // React Native's FormData accepts this file descriptor shape.
  form.append('file', {
    uri: localUri,
    name: 'target.jpg',
    type: 'image/jpeg',
  } as unknown as Blob);
  const res = await authFetch('/images/content-addressed', { method: 'POST', body: form });
  const body = await jsonOrThrow<{ imagePath: string }>(res);
  return body.imagePath;
}

export function imageUrl(filename: string): string {
  return `${API_URL}/images/${encodeURIComponent(filename)}`;
}

export function hasValidSession(): boolean {
  return accessToken !== null;
}

/** Auth header for loading protected images in <Image source={{ headers }}>. */
export function authHeaders(): Record<string, string> {
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}
