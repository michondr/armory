import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Button, Card, Field, Input } from '../components/ui';
import { ThemeToggle } from '../components/ThemeToggle';

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isRegister = mode === 'register';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (isRegister) await register({ email, password, displayName: displayName || undefined });
      else await login({ email, password });
      navigate('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-full items-center justify-center px-4">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="text-3xl">🎯</div>
          <h1 className="mt-2 text-xl font-semibold">
            {isRegister ? 'Create your account' : 'Welcome back'}
          </h1>
          <p className="text-sm text-neutral-500">Armory — shooting diary</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          {isRegister && (
            <Field label="Display name (optional)">
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </Field>
          )}
          <Field label="Email">
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </Field>
          <Field label="Password">
            <Input
              type="password"
              required
              minLength={isRegister ? 8 : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={isRegister ? 'new-password' : 'current-password'}
            />
          </Field>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? 'Please wait…' : isRegister ? 'Sign up' : 'Log in'}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-neutral-500">
          {isRegister ? (
            <>
              Already have an account?{' '}
              <Link to="/login" className="text-emerald-600 hover:underline">
                Log in
              </Link>
            </>
          ) : (
            <>
              No account?{' '}
              <Link to="/register" className="text-emerald-600 hover:underline">
                Sign up
              </Link>
            </>
          )}
        </p>
      </Card>
    </div>
  );
}
