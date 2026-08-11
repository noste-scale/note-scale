import type { Href } from "expo-router";
import { Link } from "expo-router";
import { normalizeNoteId, pitchClassOf } from "@notescale/music";
import type { PropsWithChildren, ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "./theme";

export function Screen({ children, title, subtitle }: PropsWithChildren<{ title: string; subtitle?: string }>) {
  const theme = useTheme();
  return (
    <SafeAreaView edges={["top", "left", "right", "bottom"]} style={[styles.safe, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.content} automaticallyAdjustKeyboardInsets>
        <View accessible accessibilityRole="header">
          <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
          {subtitle ? <Text style={[styles.subtitle, { color: theme.muted }]}>{subtitle}</Text> : null}
        </View>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Card({ children }: PropsWithChildren) {
  const theme = useTheme();
  return <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>{children}</View>;
}

export function Heading({ children }: PropsWithChildren) {
  const theme = useTheme();
  return <Text accessibilityRole="header" style={[styles.heading, { color: theme.text }]}>{children}</Text>;
}

export function Body({ children, muted = false, live = false }: PropsWithChildren<{ muted?: boolean; live?: boolean }>) {
  const theme = useTheme();
  return <Text accessibilityLiveRegion={live ? "polite" : "none"} style={[styles.body, { color: muted ? theme.muted : theme.text }]}>{children}</Text>;
}

export function Action({ label, accessibilityLabel, onPress, disabled = false, selected = false, hint, role = "button" }: { label: string; accessibilityLabel?: string; onPress: () => void; disabled?: boolean; selected?: boolean; hint?: string; role?: "button" | "radio" }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={hint}
      accessibilityState={role === "radio" ? { disabled, checked: selected } : { disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.action, { backgroundColor: selected ? theme.accent : theme.primary, opacity: disabled ? 0.45 : pressed ? 0.75 : 1 }]}
    >
      <Text style={[styles.actionText, { color: selected ? "#182027" : theme.primaryText }]}>{label}</Text>
    </Pressable>
  );
}

export function RouteAction({ label, href, secondary = false }: { label: string; href: Href; secondary?: boolean }) {
  const theme = useTheme();
  return (
    <Link href={href} asChild>
      <Pressable accessibilityRole="link" style={({ pressed }) => [styles.action, { backgroundColor: secondary ? theme.surface : theme.primary, borderColor: theme.primary, borderWidth: secondary ? 2 : 0, opacity: pressed ? 0.75 : 1 }]}>
        <Text style={[styles.actionText, { color: secondary ? theme.primary : theme.primaryText }]}>{label}</Text>
      </Pressable>
    </Link>
  );
}

export function Chip({ label, selected, onPress, disabled = false, role = "radio" }: { label: string; selected: boolean; onPress: () => void; disabled?: boolean; role?: "button" | "checkbox" | "radio" }) {
  const theme = useTheme();
  const accessibilityState = role === "button" ? { disabled, selected } : { checked: selected, disabled };
  return (
    <Pressable disabled={disabled} accessibilityRole={role} accessibilityState={accessibilityState} onPress={onPress} style={[styles.chip, { backgroundColor: selected ? theme.accent : theme.surface, borderColor: selected ? theme.accent : theme.border, opacity: disabled ? 0.6 : 1 }]}> 
      <Text style={[styles.chipText, { color: selected ? "#182027" : theme.text }]}>{label}</Text>
    </Pressable>
  );
}

export function Row({ children }: { children: ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

export function Formula() {
  const theme = useTheme();
  return <Text accessibilityLabel="Ton, ton, demi-ton, ton, ton, ton, demi-ton" style={[styles.formula, { color: theme.primary }]}>T – T – ½ | T – T – T – ½</Text>;
}

const pianoKeys = [
  { id: "C", label: "Do", dark: false },
  { id: "C#", label: "Do♯ / Ré♭", dark: true },
  { id: "D", label: "Ré", dark: false },
  { id: "D#", label: "Ré♯ / Mi♭", dark: true },
  { id: "E", label: "Mi", dark: false },
  { id: "F", label: "Fa", dark: false },
  { id: "F#", label: "Fa♯ / Sol♭", dark: true },
  { id: "G", label: "Sol", dark: false },
  { id: "G#", label: "Sol♯ / La♭", dark: true },
  { id: "A", label: "La", dark: false },
  { id: "A#", label: "La♯ / Si♭", dark: true },
  { id: "B", label: "Si", dark: false },
] as const;

const notePitch = (note: string): number | undefined => {
  const normalized = normalizeNoteId(note);
  return normalized ? pitchClassOf(normalized) : undefined;
};

export function Piano({ activeNotes = [], soundingPitch, onPlayNote }: { activeNotes?: string[]; soundingPitch?: number | undefined; onPlayNote: (note: string) => void }) {
  const theme = useTheme();
  const activePitches = new Set(activeNotes.flatMap((note) => {
    const value = notePitch(note);
    return value === undefined ? [] : [value];
  }));
  return (
    <View accessibilityLabel="Clavier chromatique interactif">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.piano}>
        {pianoKeys.map((key) => {
          const keyPitch = notePitch(key.id);
          const active = keyPitch !== undefined && activePitches.has(keyPitch);
          const sounding = keyPitch === soundingPitch;
          const backgroundColor = sounding ? theme.primary : active ? theme.accent : key.dark ? "#182027" : theme.surface;
          const color = sounding ? theme.primaryText : active ? "#182027" : key.dark ? "#FFFFFF" : theme.text;
          return (
            <Pressable
              key={key.id}
              accessibilityRole="button"
              accessibilityLabel={`${key.label}${active ? ", note de la gamme" : ""}${sounding ? ", en lecture" : ""}`}
              accessibilityHint="Joue cette hauteur avec un fichier audio local"
              accessibilityState={{ selected: sounding }}
              onPress={() => onPlayNote(key.id)}
              style={({ pressed }) => [styles.key, key.dark && styles.darkKey, { backgroundColor, borderColor: sounding ? theme.focus : theme.border, opacity: pressed ? 0.75 : 1 }]}
            >
              <Text style={[styles.keyText, { color }]}>{key.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export function Notice({ children, danger = false }: PropsWithChildren<{ danger?: boolean }>) {
  const theme = useTheme();
  return <View accessibilityLiveRegion="polite" style={[styles.notice, { borderColor: danger ? theme.danger : theme.primary }]}><Text style={[styles.body, { color: danger ? theme.danger : theme.text }]}>{children}</Text></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { gap: 16, padding: 20, paddingBottom: 40 },
  title: { fontSize: 32, fontWeight: "800", letterSpacing: -0.6 },
  subtitle: { fontSize: 17, lineHeight: 24, marginTop: 6 },
  card: { borderRadius: 18, borderWidth: 1, gap: 12, padding: 18 },
  heading: { fontSize: 21, fontWeight: "700" },
  body: { fontSize: 16, lineHeight: 24 },
  action: { alignItems: "center", borderRadius: 14, justifyContent: "center", minHeight: 50, paddingHorizontal: 18, paddingVertical: 12 },
  actionText: { fontSize: 16, fontWeight: "700", textAlign: "center" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  chip: { borderRadius: 14, borderWidth: 2, flexShrink: 1, justifyContent: "center", maxWidth: "100%", minHeight: 48, minWidth: 76, paddingHorizontal: 14, paddingVertical: 10 },
  chipText: { fontSize: 16, fontWeight: "600", textAlign: "center" },
  formula: { fontSize: 24, fontWeight: "800", lineHeight: 34, textAlign: "center" },
  piano: { alignItems: "flex-start", flexDirection: "row", minHeight: 112 },
  key: { alignItems: "center", borderWidth: 2, justifyContent: "flex-end", minHeight: 112, minWidth: 58, paddingBottom: 8, paddingHorizontal: 4 },
  darkKey: { minHeight: 82 },
  keyText: { fontSize: 12, fontWeight: "700", textAlign: "center" },
  notice: { borderLeftWidth: 4, paddingHorizontal: 14, paddingVertical: 10 },
});
