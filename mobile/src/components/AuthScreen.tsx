import { ReactNode } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Pressable, Text, TextInput, TextInputProps, View } from 'react-native';
import { makeStyles, useColors } from './ui';

// Shared shell for the activate / sign-in / unlock screens.
export function AuthScreen({
  subtitle,
  notice,
  error,
  children,
}: {
  subtitle: string;
  notice?: string;
  error?: string;
  children: ReactNode;
}) {
  const styles = useStyles();
  return (
    <KeyboardAvoidingView behavior="padding" style={styles.wrap}>
      <View style={styles.box}>
        <Text style={styles.title}>YORA DM</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
        {children}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    </KeyboardAvoidingView>
  );
}

export function AuthInput({ style, ...props }: TextInputProps) {
  const colors = useColors();
  const styles = useStyles();
  return <TextInput style={[styles.input, style]} placeholderTextColor={colors.muted} autoCorrect={false} {...props} />;
}

export function AuthButton({ label, busy, onPress }: { label: string; busy?: boolean; onPress: () => void }) {
  const styles = useStyles();
  return (
    <Pressable style={styles.button} onPress={onPress} disabled={busy}>
      {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{label}</Text>}
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  wrap: { flex: 1, justifyContent: 'center', backgroundColor: colors.bg, padding: 24 },
  box: { gap: 12 },
  title: { fontSize: 32, fontWeight: '800', color: colors.primary },
  subtitle: { color: colors.muted, marginBottom: 12 },
  notice: { color: colors.text, backgroundColor: colors.primarySoft, padding: 12, borderRadius: 10 },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: colors.text,
  },
  error: { color: colors.danger },
  button: { backgroundColor: colors.primary, borderRadius: 10, padding: 15, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
}));
