import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { Button } from './ui';
import { ThemeToggle } from './ThemeToggle';

function navClass({ isActive }: { isActive: boolean }): string {
  return `rounded-lg px-3 py-1.5 text-sm font-medium transition ${
    isActive
      ? 'bg-neutral-200 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100'
      : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100'
  }`;
}

export function AppLayout() {
  const { auth, logout } = useAuth();
  const navigate = useNavigate();

  const onLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-full">
      <header className="border-b border-neutral-200 bg-white/70 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/70">
        <div className="mx-auto flex max-w-4xl items-center gap-4 px-4 py-3">
          <span className="text-lg font-bold tracking-tight">🎯 Armory</span>
          <nav className="flex items-center gap-1">
            <NavLink to="/" end className={navClass}>
              Dashboard
            </NavLink>
            <NavLink to="/settings" className={navClass}>
              Settings
            </NavLink>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden text-sm text-neutral-500 sm:inline">{auth?.user.email}</span>
            <ThemeToggle />
            <Button variant="ghost" onClick={onLogout}>
              Log out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
