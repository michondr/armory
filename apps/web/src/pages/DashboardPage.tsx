import { useAuth } from '../lib/auth';
import { Card } from '../components/ui';

export function DashboardPage() {
  const { auth } = useAuth();
  const name = auth?.user.displayName ?? auth?.user.email;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-neutral-500">Welcome back, {name}.</p>
      </div>
      <Card>
        <h2 className="font-medium">Foundation is live 🎉</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Auth and per-user settings are working. Guns &amp; ammo inventory (Phase 1), then range
          sessions, target scoring, and stats (Phase 2) come next.
        </p>
      </Card>
    </div>
  );
}
