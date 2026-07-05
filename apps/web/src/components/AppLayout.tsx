import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { Button } from './ui';
import { ThemeToggle } from './ThemeToggle';

const NAV = [
  { to: '/guns', label: 'Guns', icon: '🔫' },
  { to: '/ammo', label: 'Ammo', icon: '🧊' },
  { to: '/sessions', label: 'Sessions', icon: '🎯' },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
];

function topNavClass({ isActive }: { isActive: boolean }): string {
  return `rounded-lg px-3 py-1.5 text-sm font-medium transition ${
    isActive
      ? 'bg-neutral-200 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100'
      : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100'
  }`;
}

function bottomNavClass({ isActive }: { isActive: boolean }): string {
  return `flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition ${
    isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-neutral-500'
  }`;
}

export function AppLayout() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const onLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/80 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/80">
        <div className="mx-auto flex max-w-4xl items-center gap-4 px-4 py-3">
          <Link
            to="/"
            className="flex items-center gap-2 text-lg font-bold tracking-tight"
            title="Home"
          >
            <img src="/favicon.svg" alt="" className="h-6 w-6" />
            Armory
          </Link>
          {/* Desktop inline nav */}
          <nav className="hidden items-center gap-1 sm:flex">
            {NAV.map((item) => (
              <NavLink key={item.to} to={item.to} className={topNavClass}>
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" onClick={onLogout}>
              Log out
            </Button>
          </div>
        </div>
      </header>

      {/* Extra bottom padding on mobile so the tab bar doesn't cover content. */}
      <main className="mx-auto max-w-4xl px-4 py-6 pb-24 sm:py-8 sm:pb-8">
        <Outlet />
      </main>

      {/* Mobile bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-neutral-200 bg-white/95 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/95 sm:hidden">
        {NAV.map((item) => (
          <NavLink key={item.to} to={item.to} className={bottomNavClass}>
            <span className="text-lg leading-none">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
