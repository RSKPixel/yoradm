import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { usePreventScreenCapture } from 'expo-screen-capture';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { Loading, useColors } from '../components/ui';
import { AuthProvider, useAuth } from '../lib/auth';
import { queryClient } from '../lib/queryClient';

function RootStack() {
  const { phase } = useAuth();
  if (phase === 'loading') return <Loading />;
  return (
    <Stack>
      <Stack.Protected guard={phase === 'ready'}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="party" options={{ title: 'Party' }} />
        <Stack.Screen name="invoice" options={{ title: 'Bill' }} />
      </Stack.Protected>
      <Stack.Protected guard={phase === 'activate'}>
        <Stack.Screen name="activate" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={phase === 'locked'}>
        <Stack.Screen name="lock" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  // Blocks screenshots, screen recording and the app-switcher preview.
  usePreventScreenCapture();
  const scheme = useColorScheme();
  const colors = useColors();
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  // Headers, tab bar and screen backgrounds follow the app palette.
  const theme = {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.primary,
      background: colors.bg,
      card: colors.card,
      text: colors.text,
      border: colors.border,
    },
  };
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider value={theme}>
          <StatusBar style="auto" />
          <RootStack />
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
