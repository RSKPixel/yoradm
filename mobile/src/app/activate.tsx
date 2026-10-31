import { useState } from 'react';
import { AuthButton, AuthInput, AuthScreen } from '../components/AuthScreen';
import { useAuth } from '../lib/auth';

export default function Activate() {
  const { activate, notice } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (code.replace(/[^A-Z0-9]/g, '').length !== 8) return setError('Enter the 8-character code from your admin');
    setBusy(true);
    setError('');
    try {
      await activate(code);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Activation failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthScreen
      subtitle="This phone is not authorised yet. Your admin will enter the activation code."
      notice={notice}
      error={error}
    >
      <AuthInput
        placeholder="XXXX-XXXX"
        autoCapitalize="characters"
        maxLength={9}
        value={code}
        onChangeText={(t) => setCode(t.toUpperCase())}
        onSubmitEditing={submit}
        style={{ fontSize: 24, letterSpacing: 4, textAlign: 'center' }}
      />
      <AuthButton label="Activate phone" busy={busy} onPress={submit} />
    </AuthScreen>
  );
}
