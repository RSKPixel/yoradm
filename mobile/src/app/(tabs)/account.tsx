import * as Application from 'expo-application';
import { Pressable, Text, View } from 'react-native';
import { Card, Row, SectionTitle, useColors } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { showDateTime } from '../../lib/format';

export default function Account() {
  const colors = useColors();
  const { me, lock } = useAuth();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: 16, gap: 16 }}>
      <Card>
        <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>{me?.name}</Text>
        <SectionTitle>Representatives</SectionTitle>
        <Text style={{ color: colors.text }}>{me?.reps.length ? me.reps.join(', ') : 'None assigned'}</Text>
      </Card>
      <Card>
        <Row left="This phone" right={me?.device_model || '—'} />
        <Row left="Activated" right={showDateTime(me?.activated_at)} />
        <Row left="App version" right={Application.nativeApplicationVersion ?? '—'} />
      </Card>
      <Pressable
        onPress={lock}
        style={{ backgroundColor: colors.card, borderRadius: 10, padding: 15, alignItems: 'center', borderWidth: 1, borderColor: colors.border }}
      >
        <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 16 }}>Lock now</Text>
      </Pressable>
    </View>
  );
}
