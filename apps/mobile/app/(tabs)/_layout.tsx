import { Tabs } from "expo-router";
import { SymbolView, type SymbolViewProps } from "expo-symbols";
import light from "expo-symbols/androidWeights/light";
import { View, type ColorValue } from "react-native";
import { useTheme } from "../../src/theme";

const Icon = ({ name, color }: { name: SymbolViewProps["name"]; color: ColorValue }) => (
  <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <SymbolView name={name} tintColor={color} size={24} weight={{ ios: "light", android: light }} />
  </View>
);

export default function TabLayout() {
  const theme = useTheme();
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: theme.primary, tabBarInactiveTintColor: theme.muted, tabBarStyle: { backgroundColor: theme.surface, borderTopColor: theme.border, minHeight: 64, paddingTop: 5 }, tabBarLabelStyle: { fontSize: 12, fontWeight: "700" } }}>
      <Tabs.Screen name="index" options={{ title: "Accueil", tabBarAccessibilityLabel: "Accueil", tabBarIcon: ({ color }) => <Icon color={color} name={{ ios: "house", android: "home", web: "home" }} /> }} />
      <Tabs.Screen name="learn" options={{ title: "Apprendre", tabBarAccessibilityLabel: "Apprendre", tabBarIcon: ({ color }) => <Icon color={color} name={{ ios: "book", android: "menu_book", web: "menu_book" }} /> }} />
      <Tabs.Screen name="exercises" options={{ title: "Exercices", tabBarAccessibilityLabel: "Exercices", tabBarIcon: ({ color }) => <Icon color={color} name={{ ios: "square.and.pencil", android: "edit_note", web: "edit_note" }} /> }} />
      <Tabs.Screen name="progress" options={{ title: "Progression", tabBarAccessibilityLabel: "Ma progression", tabBarIcon: ({ color }) => <Icon color={color} name={{ ios: "chart.bar", android: "bar_chart", web: "bar_chart" }} /> }} />
    </Tabs>
  );
}
