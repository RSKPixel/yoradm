import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Linking, Pressable, RefreshControl, Text, View } from 'react-native';
import { AgeingCard } from '../components/Ageing';
import { PartyStatement, StatementRef } from '../components/PartyStatement';
import { Card, ErrorText, Loading, makeStyles, SectionTitle, Stat, useColors } from '../components/ui';
import { api, Bill, PartyDetail, qs } from '../lib/api';
import { useAuth } from '../lib/auth';
import { money, showDate } from '../lib/format';
import { copyStatement, shareStatement } from '../lib/share';

function CallButton({ number }: { number: string }) {
  const styles = useStyles();
  return (
    <Pressable style={styles.action} onPress={() => Linking.openURL(`tel:${number.replace(/[^\d+]/g, '')}`)}>
      <Text style={styles.actionText}>Call {number}</Text>
    </Pressable>
  );
}

function IconButton({
  icon,
  label,
  busy,
  disabled,
  onPress,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  busy: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  const styles = useStyles();
  return (
    <Pressable
      style={({ pressed }) => [styles.iconButton, pressed && { opacity: 0.6 }]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
    >
      {busy ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <MaterialCommunityIcons name={icon} size={22} color={colors.primary} />
      )}
    </Pressable>
  );
}

function BillRow({ bill }: { bill: Bill }) {
  const colors = useColors();
  const styles = useStyles();
  const late = (bill.days ?? 0) > 90;
  return (
    <View style={styles.bill}>
      <View style={{ flex: 1 }}>
        <Text style={styles.billNo}>{bill.invoice_no || '—'}</Text>
        <Text style={styles.billSub}>
          {showDate(bill.invoice_date)}
          {bill.due_date ? ` · due ${showDate(bill.due_date)}` : ''}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={styles.amount}>{money(bill.amount)}</Text>
        <Text style={[styles.billSub, late && { color: colors.danger, fontWeight: '600' }]}>
          {bill.days != null ? `${bill.days} days` : 'Undated'}
        </Text>
      </View>
      {bill.invoice_no ? <Text style={styles.chevron}>›</Text> : null}
    </View>
  );
}

export default function Party() {
  const colors = useColors();
  const styles = useStyles();
  const { me } = useAuth();
  const router = useRouter();
  const { ledger, rep } = useLocalSearchParams<{ ledger: string; rep?: string }>();
  const statementRef = useRef<StatementRef>(null);
  const [busy, setBusy] = useState<'' | 'copy' | 'share'>('');
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [copied, setCopied] = useState(false);

  // Tick on the copy icon for a moment after a successful copy.
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  const q = useQuery({
    queryKey: ['receivables', 'party', ledger, rep ?? ''],
    queryFn: () => api<PartyDetail>(`/m/receivables/party${qs({ ledger, rep })}`),
    enabled: !!ledger,
  });
  const d = q.data;

  async function run(kind: 'copy' | 'share') {
    if (!d) return;
    setBusy(kind);
    setMessage(null);
    try {
      const target = { ledger: d.ledger_name, rep };
      if (kind === 'copy') {
        await copyStatement(statementRef, target);
        setCopied(true);
        setMessage({ text: 'Copied. Paste it into WhatsApp.' });
      } else {
        await shareStatement(statementRef, target);
      }
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : 'Could not create the image', error: true });
    } finally {
      setBusy('');
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: ledger ?? 'Party' }} />
      {q.isLoading ? (
        <Loading />
      ) : q.error || !d ? (
        <ErrorText error={q.error} />
      ) : (
        <>
          {/* Off-screen copy of the statement, captured as the PNG for copy/share. */}
          <View style={styles.offscreen} pointerEvents="none">
            <PartyStatement
              ref={statementRef}
              companyName={me?.company_name ?? ''}
              ledgerName={d.ledger_name}
              bills={d.bills}
              total={d.totals.total}
            />
          </View>
          <FlatList
            style={{ backgroundColor: colors.bg }}
            contentContainerStyle={{ padding: 16 }}
            data={d.bills}
            keyExtractor={(b, i) => `${b.invoice_no}-${i}`}
            refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} />}
            ListHeaderComponent={
              <View style={{ gap: 12 }}>
                {rep ? <Text style={styles.repTag}>Representative: {rep}</Text> : null}
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Stat label="Total due" value={money(d.totals.total)} />
                  <Stat label="Bills" value={String(d.totals.invoice_count)} />
                </View>
                <View style={styles.iconRow}>
                  <IconButton
                    icon={copied ? 'check' : 'content-copy'}
                    label="Copy statement"
                    busy={busy === 'copy'}
                    disabled={!!busy}
                    onPress={() => run('copy')}
                  />
                  <IconButton
                    icon="share-variant"
                    label="Share statement"
                    busy={busy === 'share'}
                    disabled={!!busy}
                    onPress={() => run('share')}
                  />
                </View>
                {message ? (
                  <Text style={[styles.message, message.error && { color: colors.danger }]}>{message.text}</Text>
                ) : null}
                {d.mobile && <CallButton number={d.mobile} />}
                {d.phone && d.phone !== d.mobile && <CallButton number={d.phone} />}
                <AgeingCard buckets={d.totals} />
                <SectionTitle>Bills</SectionTitle>
              </View>
            }
            renderItem={({ item }) => (
              <Pressable
                disabled={!item.invoice_no}
                style={({ pressed }) => pressed && { opacity: 0.6 }}
                onPress={() =>
                  router.push({
                    pathname: '/invoice',
                    params: { ledger: d.ledger_name, invoice_no: item.invoice_no ?? '', ...(rep ? { rep } : {}) },
                  })
                }
              >
                <Card style={{ marginBottom: 8 }}>
                  <BillRow bill={item} />
                </Card>
              </Pressable>
            )}
          />
        </>
      )}
    </>
  );
}

const useStyles = makeStyles((colors) => ({
  offscreen: { position: 'absolute', left: -10000, top: 0 },
  action: { backgroundColor: colors.primarySoft, borderRadius: 10, padding: 12, alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  iconRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: { color: colors.primary, fontWeight: '700', fontSize: 15 },
  message: { color: colors.muted, textAlign: 'center', fontSize: 13 },
  repTag: { color: colors.muted, fontSize: 13 },
  bill: { flexDirection: 'row', alignItems: 'center' },
  billNo: { color: colors.text, fontSize: 15, fontWeight: '600' },
  billSub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  amount: { color: colors.text, fontSize: 15, fontWeight: '700' },
  chevron: { color: colors.muted, fontSize: 22, marginLeft: 10 },
}));
