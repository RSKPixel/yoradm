import * as LocalAuthentication from 'expo-local-authentication';
import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { activateDevice, api, Me, setAccessToken, setDeviceLostHandler, startSession } from './api';
import { deviceInfo, getCreds, newCreds, saveCreds, wipeDevice } from './device';
import { queryClient } from './queryClient';

// activate (once, in person) → locked ⇄ ready. There is no login: the phone is the credential,
// guarded by the phone's own screen lock.
export type Phase = 'loading' | 'activate' | 'locked' | 'ready';

type AuthState = {
  phase: Phase;
  me: Me | null;
  notice: string;
  activate: (code: string) => Promise<void>;
  unlock: () => Promise<void>;
  lock: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

// Background longer than this and the app locks again.
const LOCK_AFTER_MS = 60_000;
const NO_SCREEN_LOCK = 'Set a screen lock (PIN, pattern or fingerprint) on this phone to use YORA DM.';

async function hasScreenLock() {
  try {
    const level = await LocalAuthentication.getEnrolledLevelAsync();
    return level !== LocalAuthentication.SecurityLevel.NONE;
  } catch {
    return false;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [me, setMe] = useState<Me | null>(null);
  const [notice, setNotice] = useState('');
  const backgroundAt = useRef<number | null>(null);
  const phaseRef = useRef<Phase>('loading');
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // Drop everything held in memory: token, cached receivables, profile.
  const clearSession = useCallback(() => {
    setAccessToken(null);
    queryClient.clear();
    setMe(null);
  }, []);

  const lock = useCallback(() => {
    clearSession();
    setNotice('');
    setPhase('locked');
  }, [clearSession]);

  const deviceLost = useCallback(
    async (message?: string) => {
      clearSession();
      await wipeDevice();
      setNotice(message ?? 'This phone is no longer authorised. Ask your admin to authorise it again.');
      setPhase('activate');
    },
    [clearSession],
  );

  const enterApp = useCallback(async () => {
    await startSession();
    setMe(await api<Me>('/m/me'));
    setNotice('');
    setPhase('ready');
  }, []);

  useEffect(() => {
    setDeviceLostHandler((m) => void deviceLost(m));
    (async () => {
      setPhase((await getCreds()) ? 'locked' : 'activate');
    })();
  }, [deviceLost]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') {
        backgroundAt.current = Date.now();
      } else if (state === 'active' && backgroundAt.current !== null) {
        const away = Date.now() - backgroundAt.current;
        backgroundAt.current = null;
        if (phaseRef.current === 'ready' && away > LOCK_AFTER_MS) lock();
      }
    });
    return () => sub.remove();
  }, [lock]);

  async function activate(code: string) {
    if (!(await hasScreenLock())) throw new Error(NO_SCREEN_LOCK);
    const creds = newCreds();
    await activateDevice({ ...creds, code, ...(await deviceInfo()) });
    await saveCreds(creds);
    await enterApp();
  }

  // Stable identity: the lock screen prompts once on mount with it.
  const unlock = useCallback(async () => {
    if (!(await hasScreenLock())) throw new Error(NO_SCREEN_LOCK);
    const result = await LocalAuthentication.authenticateAsync({ promptMessage: 'Unlock YORA DM' });
    if (!result.success) return;
    await enterApp();
  }, [enterApp]);

  return (
    <AuthContext.Provider value={{ phase, me, notice, activate, unlock, lock }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}
