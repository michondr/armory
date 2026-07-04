import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { LoginInput, RegisterInput } from '@armory/shared';
import { authApi, loadAuth, setAuth, type StoredAuth } from './api';

interface AuthState {
  auth: StoredAuth | null;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setLocal] = useState<StoredAuth | null>(() => loadAuth());

  useEffect(() => {
    const handler = () => setLocal(loadAuth());
    window.addEventListener('armory-auth', handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener('armory-auth', handler);
      window.removeEventListener('storage', handler);
    };
  }, []);

  const login = useCallback(async (input: LoginInput) => {
    setAuth(await authApi.login(input));
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    setAuth(await authApi.register(input));
  }, []);

  const logout = useCallback(async () => {
    const current = loadAuth();
    if (current) {
      try {
        await authApi.logout(current.refreshToken);
      } catch {
        /* best-effort */
      }
    }
    setAuth(null);
  }, []);

  return (
    <AuthContext.Provider value={{ auth, login, register, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
