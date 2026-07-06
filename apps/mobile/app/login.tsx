import { useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiError, OfflineError } from '../src/lib/api';
import { useAuth } from '../src/state/auth';
import { theme } from '../src/theme';
import { Button, Field, Screen, Subtle, TextField, Title } from '../src/ui/components';

export default function Login() {
  const { login, register } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      if (mode === 'login') {
        await login({ email: email.trim(), password });
      } else {
        await register({
          email: email.trim(),
          password,
          displayName: displayName.trim() || undefined,
        });
      }
      router.replace('/(tabs)');
    } catch (e) {
      if (e instanceof OfflineError) setError('No connection — check your network and try again.');
      else if (e instanceof ApiError) setError(e.message);
      else setError('Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <Screen>
        <View style={{ gap: 6, marginTop: 24, marginBottom: 8 }}>
          <Title>Armory</Title>
          <Subtle>{mode === 'login' ? 'Sign in to sync your range diary.' : 'Create an account.'}</Subtle>
        </View>

        {mode === 'register' && (
          <Field label="Display name (optional)">
            <TextField value={displayName} onChangeText={setDisplayName} autoCapitalize="words" />
          </Field>
        )}
        <Field label="Email">
          <TextField
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
        </Field>
        <Field label="Password">
          <TextField value={password} onChangeText={setPassword} secureTextEntry />
        </Field>

        {error && <Text style={{ color: theme.danger }}>{error}</Text>}

        <Button title={mode === 'login' ? 'Sign in' : 'Create account'} onPress={submit} loading={busy} />
        <Button
          variant="ghost"
          title={mode === 'login' ? 'Need an account? Register' : 'Have an account? Sign in'}
          onPress={() => {
            setMode(mode === 'login' ? 'register' : 'login');
            setError(null);
          }}
        />
      </Screen>
    </SafeAreaView>
  );
}
