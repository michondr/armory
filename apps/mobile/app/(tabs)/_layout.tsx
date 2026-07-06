import { Text, type ColorValue } from 'react-native';
import { Redirect, Tabs } from 'expo-router';
import { useAuth } from '../../src/state/auth';
import { theme } from '../../src/theme';

function icon(emoji: string) {
  return ({ color }: { color: ColorValue }) => (
    <Text style={{ fontSize: 20, color }}>{emoji}</Text>
  );
}

export default function TabsLayout() {
  const { user, loading } = useAuth();
  if (!loading && !user) return <Redirect href="/login" />;

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: theme.bg },
        headerTintColor: theme.text,
        tabBarStyle: { backgroundColor: theme.card, borderTopColor: theme.cardBorder },
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.textFaint,
        sceneStyle: { backgroundColor: theme.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Sessions', tabBarIcon: icon('🎯') }} />
      <Tabs.Screen name="guns" options={{ title: 'Guns', tabBarIcon: icon('🔫') }} />
      <Tabs.Screen name="ammo" options={{ title: 'Ammo', tabBarIcon: icon('🧊') }} />
      <Tabs.Screen name="ballistics" options={{ title: 'Ballistics', tabBarIcon: icon('📈') }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: icon('⚙️') }} />
    </Tabs>
  );
}
