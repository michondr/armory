import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { getDb } from '../src/db/client';
import { AuthProvider } from '../src/state/auth';
import { SyncProvider } from '../src/state/sync';
import { theme } from '../src/theme';

export default function RootLayout() {
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    // Open + migrate the local database before rendering anything data-driven.
    getDb().then(() => setDbReady(true));
  }, []);

  if (!dbReady) return <View style={{ flex: 1, backgroundColor: theme.bg }} />;

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <SyncProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: theme.bg },
              headerTintColor: theme.text,
              contentStyle: { backgroundColor: theme.bg },
            }}
          >
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="session/new" options={{ title: 'New session' }} />
            <Stack.Screen name="session/[id]" options={{ title: 'Session' }} />
            <Stack.Screen name="timer" options={{ title: 'Shot timer' }} />
          </Stack>
        </SyncProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
