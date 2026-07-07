import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { API_URL } from '../../src/lib/config';
import { useAuth } from '../../src/state/auth';
import { useSync } from '../../src/state/sync';
import { theme } from '../../src/theme';
import { Button, Card, Row, Screen, Subtle, Title } from '../../src/ui/components';
import { SyncBar } from '../../src/ui/SyncBar';
import { SyncDiagnostics } from '../../src/ui/SyncDiagnostics';

export default function SettingsTab() {
  const { user, logout } = useAuth();
  const { pending } = useSync();
  const router = useRouter();

  return (
    <Screen>
      <Title>Settings</Title>
      <SyncBar />
      <SyncDiagnostics />

      <Card>
        <Text style={{ color: theme.text, fontWeight: '600' }}>{user?.displayName ?? user?.email}</Text>
        <Subtle>{user?.email}</Subtle>
        <Row style={{ justifyContent: 'space-between' }}>
          <Subtle>Pending changes</Subtle>
          <Text style={{ color: theme.text }}>{pending}</Text>
        </Row>
        <Row style={{ justifyContent: 'space-between' }}>
          <Subtle>API</Subtle>
          <Text style={{ color: theme.textFaint, fontSize: 12 }}>{API_URL}</Text>
        </Row>
      </Card>

      <Card>
        <Text style={{ color: theme.text, fontWeight: '600' }}>Range tools</Text>
        <Subtle>Ballistics and the shot timer work fully offline.</Subtle>
        <Button title="Shot timer" variant="ghost" onPress={() => router.push('/timer')} />
      </Card>

      <Button
        title="Log out"
        variant="danger"
        onPress={async () => {
          await logout();
          router.replace('/login');
        }}
      />
      <Subtle>Logging out clears the local synced copy on next login refresh. Unsynced changes are pushed on your next connection before you log out if possible.</Subtle>
    </Screen>
  );
}
