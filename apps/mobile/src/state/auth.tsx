import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { LoginInput, RegisterInput } from '@armory/shared';
import { authApi, clearSession, loadSession, type StoredUser } from '../lib/api';

interface AuthState {
  user: StoredUser | null;
  /** Still restoring the persisted session on boot. */
  loading: boolean;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restore tokens from secure storage. Once restored the user stays "logged
    // in" offline indefinitely — auth is only exercised when we actually sync.
    loadSession()
      .then(setUser)
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (input: LoginInput) => {
    setUser(await authApi.login(input));
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    setUser(await authApi.register(input));
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    await clearSession();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, logout }),
    [user, loading, login, register, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
