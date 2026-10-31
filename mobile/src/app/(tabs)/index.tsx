import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, Text, TextInput, View } from 'react-native';
import { AgeingCard } from '../../components/Ageing';
import { Chips, ErrorText, Loading, makeStyles, Row, SectionTitle, Stat, useColors } from '../../components/ui';
import { api, PartyRow, qs, Summary } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { money, showDate } from '../../lib/format';

type Sort = 'amount' | 'oldest' | 'name';
const SORTS: { key: Sort; label: string }[] = [
  { key: 'amount', label: 'Highest due' },
  { key: 'oldest', label: 'Oldest bill' },
  { key: 'name', label: 'A–Z' },
];

export default function Receivables() {
  const colors = useColors();
  const styles = useStyles();
  const router = useRouter();
  const { me } = useAuth();
  const reps = me?.reps ?? [];
  const [rep, setRep] = useState('');
  const [sort, setSort] = useState<Sort>('amount');
  const [search, setSearch] = useState('');

  // The selected rep filters everything: totals, ageing, parties and the party screen.
  const summary = useQuery({
    queryKey: ['receivables', 'summary', rep],
    queryFn: () => api<Summary>(`/m/receivables/summary${qs({ rep })}`),
  });
  // Unfiltered summary (shares the cache with the "All" view): which reps have anything pending.
  const allSummary = useQuery({
    queryKey: ['receivables', 'summary', ''],
    queryFn: () => api<Summary>('/m/receivables/summary'),
  });
  const pendingReps = (allSummary.data?.reps ?? []).filter((r) => r.invoice_count > 0).map((r) => r.name);
  const parties = useQuery({
    queryKey: ['receivables', 'parties', rep],
    queryFn: () => api<PartyRow[]>(`/m/receivables/parties${qs({ rep })}`),
  });

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = (parties.data ?? []).filter((p) => !q || p.ledger_name.toLowerCase().includes(q));
    if (sort === 'oldest') return [...list].sort((a, b) => (b.oldest_days ?? -1) - (a.oldest_days ?? -1));
    if (sort === 'name') return [...list].sort((a, b) => a.ledger_name.localeCompare(b.ledger_name, 'en', { sensitivity: 'base' }));
    return list;
  }, [parties.data, search, sort]);

  const refreshing = summary.isRefetching || parties.isRefetching;

  if (me && reps.length === 0) {
    return <Text style={styles.empty}>No representatives are assigned to you yet. Contact your admin.</Text>;
  }

  const header = (
    <View style={{ gap: 12 }}>
      {pendingReps.length > 1 && (
        <Chips
          options={[{ key: '', label: 'All' }, ...pendingReps.map((r) => ({ key: r, label: r }))]}
          value={rep}
          onChange={setRep}
        />
      )}
      {summary.isLoading ? (
        <Loading />
      ) : summary.error ? (
        <ErrorText error={summary.error} />
      ) : summary.data ? (
        <>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Stat label="Total due" value={money(summary.data.totals.total)} />
            <Stat label="Bills" value={String(summary.data.totals.invoice_count)} />
          </View>
          <AgeingCard buckets={summary.data.totals} />
          {summary.data.synced_at && (
            <Text style={styles.muted}>Tally data as on {showDate(summary.data.synced_at)}</Text>
          )}
        </>
      ) : null}
      <SectionTitle>Parties</SectionTitle>
      <Chips options={SORTS} value={sort} onChange={setSort} />
      <TextInput
        style={styles.search}
        placeholder="Search party"
        placeholderTextColor={colors.muted}
        value={search}
        onChangeText={setSearch}
        clearButtonMode="while-editing"
      />
    </View>
  );

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16 }}
      data={rows}
      keyExtractor={(p) => p.ledger_name}
      ListHeaderComponent={header}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            void allSummary.refetch();
            void summary.refetch();
            void parties.refetch();
          }}
        />
      }
      renderItem={({ item }) => (
        <Row
          left={item.ledger_name}
          sub={`${item.invoice_count} bill${item.invoice_count === 1 ? '' : 's'}${
            item.oldest_days != null ? ` · oldest ${item.oldest_days} days` : ''
          }`}
          right={money(item.total)}
          onPress={() =>
            router.push({ pathname: '/party', params: { ledger: item.ledger_name, ...(rep ? { rep } : {}) } })
          }
        />
      )}
      ListEmptyComponent={
        parties.isLoading ? (
          <Loading />
        ) : parties.error ? (
          <ErrorText error={parties.error} />
        ) : (
          <Text style={styles.empty}>No outstanding bills</Text>
        )
      }
    />
  );
}

const useStyles = makeStyles((colors) => ({
  search: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: colors.text,
  },
  muted: { color: colors.muted, fontSize: 12, textAlign: 'center' },
  empty: { color: colors.muted, textAlign: 'center', margin: 24 },
}));
