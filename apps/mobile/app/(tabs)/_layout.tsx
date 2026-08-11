import { Tabs } from "expo-router";
import { Text, type ColorValue } from "react-native";
import { useTheme } from "../../src/theme";

const Icon = ({ symbol, color }: { symbol: string; color: ColorValue }) => <Text accessibilityElementsHidden style={{ color, fontSize: 20 }}>{symbol}</Text>;

export default function TabLayout() {
  const theme = useTheme();
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: theme.primary, tabBarInactiveTintColor: theme.muted, tabBarStyle: { backgroundColor: theme.surface, borderTopColor: theme.border, minHeight: 64, paddingBottom: 7, paddingTop: 5 }, tabBarLabelStyle: { fontSize: 12, fontWeight: "700" } }}>
      <Tabs.Screen name="index" options={{ title: "Accueil", tabBarAccessibilityLabel: "Accueil", tabBarIcon: ({ color }) => <Icon color={color} symbol="⌂" /> }} />
      <Tabs.Screen name="learn" options={{ title: "Apprendre", tabBarAccessibilityLabel: "Apprendre", tabBarIcon: ({ color }) => <Icon color={color} symbol="♪" /> }} />
      <Tabs.Screen name="exercises" options={{ title: "Exercices", tabBarAccessibilityLabel: "Exercices", tabBarIcon: ({ color }) => <Icon color={color} symbol="?" /> }} />
      <Tabs.Screen name="progress" options={{ title: "Progression", tabBarAccessibilityLabel: "Ma progression", tabBarIcon: ({ color }) => <Icon color={color} symbol="✓" /> }} />
    </Tabs>
  );
}
