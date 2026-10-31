import { ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';

const light = {
  bg: '#F4F6F8',
  card: '#FFFFFF',
  text: '#1B2430',
  muted: '#6B7785',
  border: '#E3E7EB',
  primary: '#0B6E4F',
  primarySoft: '#E3F2EC',
  danger: '#C0392B',
};

export type Colors = typeof light;

const dark: Colors = {
  bg: '#0F1418',
  card: '#1A2128',
  text: '#E6EAEE',
  muted: '#8A96A3',
  border: '#2A333C',
  primary: '#25875F',
  primarySoft: '#173A2E',
  danger: '#E5675A',
};

// Follows the phone's light/dark setting.
export function useColors(): Colors {
  return useColorScheme() === 'dark' ? dark : light;
}

type Styles = Parameters<typeof StyleSheet.create>[0];

// Builds a stylesheet once per theme and returns a hook that picks the current one.
// The `& Styles` mirrors StyleSheet.create so values like 'row' keep their literal types.
export function makeStyles<S extends Styles>(build: (c: Colors) => S & Styles) {
  const cache = new Map<Colors, Readonly<S>>();
  return () => {
    const c = useColors();
    let styles = cache.get(c);
    if (!styles) {
      styles = StyleSheet.create(build(c));
      cache.set(c, styles);
    }
    return styles;
  };
}

export function Card({ children, style }: { children: ReactNode; style?: object }) {
  const s = useS();
  return <View style={[s.card, style]}>{children}</View>;
}

export function Stat({ label, value }: { label: string; value: string }) {
  const s = useS();
  return (
    <Card style={{ flex: 1 }}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={s.statValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </Card>
  );
}

export function Chips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (k: T) => void;
}) {
  const s = useS();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable key={o.key} onPress={() => onChange(o.key)} style={[s.chip, active && s.chipActive]}>
            <Text style={[s.chipText, active && s.chipTextActive]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function Row({ left, sub, right, onPress }: { left: string; sub?: string; right: string; onPress?: () => void }) {
  const s = useS();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.row, pressed && onPress && { opacity: 0.6 }]}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={s.rowTitle} numberOfLines={1}>
          {left}
        </Text>
        {sub ? <Text style={s.rowSub}>{sub}</Text> : null}
      </View>
      <Text style={s.rowRight}>{right}</Text>
    </Pressable>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  const s = useS();
  return <Text style={s.section}>{children}</Text>;
}

export function Loading() {
  const colors = useColors();
  return <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />;
}

export function ErrorText({ error }: { error: unknown }) {
  const s = useS();
  return <Text style={s.error}>{error instanceof Error ? error.message : 'Something went wrong'}</Text>;
}

const useS = makeStyles((colors) => ({
  card: { backgroundColor: colors.card, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.border },
  statLabel: { color: colors.muted, fontSize: 12, marginBottom: 4 },
  statValue: { color: colors.text, fontSize: 18, fontWeight: '700' },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontSize: 13 },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  rowTitle: { color: colors.text, fontSize: 15 },
  rowSub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  rowRight: { color: colors.text, fontSize: 15, fontWeight: '600' },
  section: { color: colors.muted, fontSize: 13, fontWeight: '600', marginTop: 18, marginBottom: 6, textTransform: 'uppercase' },
  error: { color: colors.danger, textAlign: 'center', margin: 24 },
}));
