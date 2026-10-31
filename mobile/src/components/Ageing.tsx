import { Text, View } from 'react-native';
import { Buckets } from '../lib/api';
import { money } from '../lib/format';
import { Card, makeStyles, SectionTitle, useColors } from './ui';

const ROWS: { key: keyof Buckets; label: string; late?: boolean }[] = [
  { key: 'bucket_0_30', label: '0–30 days' },
  { key: 'bucket_31_60', label: '31–60 days' },
  { key: 'bucket_61_90', label: '61–90 days' },
  { key: 'bucket_91_120', label: '91–120 days', late: true },
  { key: 'bucket_above_120', label: 'Above 120 days', late: true },
  { key: 'bucket_undated', label: 'Undated' },
];

export function AgeingCard({ buckets }: { buckets: Buckets }) {
  const colors = useColors();
  const s = useStyles();
  const total = buckets.total || 1;
  return (
    <Card>
      <SectionTitle>Ageing</SectionTitle>
      {ROWS.filter((r) => buckets[r.key] || r.key !== 'bucket_undated').map((r) => {
        const value = buckets[r.key];
        const color = r.late ? colors.danger : colors.primary;
        return (
          <View key={r.key} style={s.row}>
            <Text style={s.label}>{r.label}</Text>
            <View style={s.track}>
              <View style={[s.bar, { width: `${Math.max(0, (value / total) * 100)}%`, backgroundColor: color }]} />
            </View>
            <Text style={[s.value, r.late && value > 0 && { color: colors.danger }]}>{money(value)}</Text>
          </View>
        );
      })}
    </Card>
  );
}

const useStyles = makeStyles((colors) => ({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 10 },
  label: { color: colors.text, fontSize: 13, width: 104 },
  track: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.border, overflow: 'hidden' },
  bar: { height: 8, borderRadius: 4 },
  value: { color: colors.text, fontSize: 13, fontWeight: '600', width: 96, textAlign: 'right' },
}));
