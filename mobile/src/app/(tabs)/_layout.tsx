import { Tabs } from 'expo-router';
import { ColorValue, Text } from 'react-native';
import { useColors } from '../../components/ui';

function TabIcon({ glyph, color }: { glyph: string; color: ColorValue }) {
  return <Text style={{ color, fontSize: 20 }}>{glyph}</Text>;
}

const icon = (glyph: string) =>
  function Icon({ color }: { color: ColorValue }) {
    return <TabIcon glyph={glyph} color={color} />;
  };

export default function TabLayout() {
  const colors = useColors();
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: colors.primary }}>
      <Tabs.Screen name="index" options={{ title: 'Receivables', tabBarIcon: icon('₹') }} />
      <Tabs.Screen name="account" options={{ title: 'Account', tabBarIcon: icon('☺') }} />
    </Tabs>
  );
}
