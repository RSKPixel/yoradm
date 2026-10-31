import { useEffect, useState } from 'react';
import { AuthButton, AuthScreen } from '../components/AuthScreen';
import { useAuth } from '../lib/auth';

export default function Lock() {
  const { unlock, notice } = useAuth();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function tryUnlock() {
    setBusy(true);
    setError('');
    try {
      await unlock();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not unlock');
    } finally {
      setBusy(false);
    }
  }

  // Prompt for the screen lock straight away.
  useEffect(() => {
    unlock().catch((e) => setError(e instanceof Error ? e.message : 'Could not unlock'));
  }, [unlock]);

  return (
    <AuthScreen subtitle="Locked" notice={notice} error={error}>
      <AuthButton label="Unlock" busy={busy} onPress={tryUnlock} />
    </AuthScreen>
  );
}
