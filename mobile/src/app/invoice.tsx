import { useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { Card, ErrorText, Loading, makeStyles, Row, SectionTitle, Stat, useColors } from '../components/ui';
import { api, InvoiceDetail, InvoiceLine, qs } from '../lib/api';
import { money, qty, showDate } from '../lib/format';

function LineCard({ line }: { line: InvoiceLine }) {
  const styles = useStyles();
  const sub = [line.brand, line.packing ? `${qty(line.packing)} kg pack` : null].filter(Boolean).join(' · ');
  const alt = line.qty_alt ? ` (${[qty(line.qty_alt), line.alternate_unit].filter(Boolean).join(' ')})` : '';
  return (
    <Card style={{ marginBottom: 8 }}>
      <Text style={styles.item}>{line.stock_item || '—'}</Text>
      {sub ? <Text style={styles.sub}>{sub}</Text> : null}
      <View style={styles.figures}>
        <Text style={styles.figure}>
          Qty {qty(line.qty)}
          {alt}
        </Text>
        <Text style={styles.figure}>Rate {line.rate != null ? qty(line.rate) : '—'}</Text>
        <Text style={styles.lineAmount}>{money(line.amount)}</Text>
      </View>
      {line.discount ? <Text style={styles.sub}>Discount {money(line.discount)}</Text> : null}
      {line.cartage ? <Text style={styles.sub}>Cartage {money(line.cartage)}</Text> : null}
    </Card>
  );
}

export default function Invoice() {
  const colors = useColors();
  const styles = useStyles();
  const { ledger, invoice_no, rep } = useLocalSearchParams<{ ledger: string; invoice_no: string; rep?: string }>();
  const q = useQuery({
    queryKey: ['receivables', 'invoice', ledger, invoice_no, rep ?? ''],
    queryFn: () => api<InvoiceDetail>(`/m/receivables/invoice${qs({ ledger, invoice_no, rep })}`),
    enabled: !!ledger && !!invoice_no,
  });
  const d = q.data;

  return (
    <>
      <Stack.Screen options={{ title: invoice_no ? `Bill ${invoice_no}` : 'Bill' }} />
      {q.isLoading ? (
        <Loading />
      ) : q.error || !d ? (
        <ErrorText error={q.error} />
      ) : (
        <ScrollView
          style={{ backgroundColor: colors.bg }}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} />}
        >
          <Text style={styles.party}>{d.ledger_name}</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Stat label="Outstanding" value={money(d.outstanding)} />
            {d.found ? <Stat label="Bill value" value={money(d.total_amount)} /> : null}
          </View>
          <Card>
            <Row left="Bill date" right={showDate(d.invoice_date)} />
            <Row left="Age" right={d.days != null ? `${d.days} days` : 'Undated'} />
            {d.representative ? <Row left="Representative" right={d.representative} /> : null}
            {d.broker ? <Row left="Broker" right={d.broker} /> : null}
          </Card>

          {d.found ? (
            <>
              <SectionTitle>Items</SectionTitle>
              <View>
                {d.lines.map((line, i) => (
                  <LineCard key={i} line={line} />
                ))}
              </View>
              {d.lines.length > 1 ? (
                <Card>
                  <Row left="Total qty" right={qty(d.total_qty)} />
                  <Row left="Total" right={money(d.total_amount)} />
                </Card>
              ) : null}
            </>
          ) : (
            <Card>
              <Text style={styles.missingTitle}>Invoice details not available</Text>
              <Text style={styles.sub}>
                This bill is not in the synced sales data. It may be from an earlier year, a credit note or an
                opening balance.
              </Text>
            </Card>
          )}
        </ScrollView>
      )}
    </>
  );
}

const useStyles = makeStyles((colors) => ({
  party: { color: colors.text, fontSize: 17, fontWeight: '700' },
  item: { color: colors.text, fontSize: 15, fontWeight: '600' },
  sub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  figures: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 12 },
  figure: { color: colors.text, fontSize: 13 },
  lineAmount: { color: colors.text, fontSize: 15, fontWeight: '700', marginLeft: 'auto' },
  missingTitle: { color: colors.text, fontSize: 15, fontWeight: '600', marginBottom: 4 },
}));
