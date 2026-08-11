import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ProgressProvider } from "../src/progress";
import { ThemeProvider, useTheme } from "../src/theme";

export default function RootLayout() {
  return <ThemeProvider><Navigation /></ThemeProvider>;
}

function Navigation() {
  const theme = useTheme();
  return (
    <ProgressProvider>
      <StatusBar style={theme.background === "#101619" ? "light" : "dark"} />
      <Stack screenOptions={{ contentStyle: { backgroundColor: theme.background }, headerStyle: { backgroundColor: theme.surface }, headerTintColor: theme.text, headerBackTitle: "Retour" }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="scales" options={{ title: "Toutes les gammes" }} />
        <Stack.Screen name="scale/[id]" options={{ title: "Détail de la gamme" }} />
        <Stack.Screen name="generator" options={{ title: "Générateur" }} />
        <Stack.Screen name="lesson/[id]" options={{ title: "Leçon" }} />
      </Stack>
    </ProgressProvider>
  );
}
