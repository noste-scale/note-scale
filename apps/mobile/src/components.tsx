import type { Href } from "expo-router";
import { Link } from "expo-router";
import type { PropsWithChildren, ReactNode } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "./theme";

export { Piano } from "./piano";

export function Screen({ children, title, subtitle, nativeHeader = false }: PropsWithChildren<{
  title?: string;
  subtitle?: string;
  nativeHeader?: boolean
}>) {
  const theme = useTheme();

  return (
    <SafeAreaView
      edges={nativeHeader ? ["left", "right", "bottom"] : ["top", "left", "right", "bottom"]}
      style={[styles.safe, { backgroundColor: theme.background }]}
    >
      <ScrollView contentContainerStyle={styles.content} automaticallyAdjustKeyboardInsets>
        <View accessible accessibilityRole={title ? "header" : undefined}>
          {title
            ? <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
            : null}
          {subtitle
            ? <Text style={[styles.subtitle, { color: theme.muted }]}>{subtitle}</Text>
            : null}
        </View>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Card({ children }: PropsWithChildren) {
  const theme = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      {children}
    </View>
  );
}

export function Heading({ children }: PropsWithChildren) {
  const theme = useTheme();

  return <Text accessibilityRole="header" style={[styles.heading, { color: theme.text }]}>{children}</Text>;
}

export function Body({ children, muted = false, live = false }: PropsWithChildren<{
  muted?: boolean;
  live?: boolean
}>) {
  const theme = useTheme();

  return (
    <Text
      accessibilityLiveRegion={live ? "polite" : "none"}
      style={[styles.body, { color: muted ? theme.muted : theme.text }]}
    >{children}</Text>
  );
}

function chooseActionOpacity(disabled: boolean, pressed: boolean): number {
  if (disabled) return 0.45;
  if (pressed) return 0.75;

  return 1;
}

export function Action({
  label,
  accessibilityLabel,
  onPress,
  disabled = false,
  selected = false,
  secondary = false,
  expanded,
  hint,
  role = "button"
}: {
  label: string;
  accessibilityLabel?: string;
  onPress: () => void;
  disabled?: boolean;
  selected?: boolean;
  secondary?: boolean;
  expanded?: boolean;
  hint?: string;
  role?: "button" | "radio"
}) {
  const theme = useTheme();
  const accessibilityState = role === "radio"
    ? { disabled, checked: selected }
    : {
      disabled,
      selected,
      ...(expanded === undefined ? {} : { expanded })
    };
  let backgroundColor: string = secondary ? theme.surface : theme.primary;
  let textColor: string = secondary ? theme.primary : theme.primaryText;

  if (selected) {
    backgroundColor = theme.accent;
    textColor = "#182027";
  }

  return (
    <Pressable
      accessibilityRole={role}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={hint}
      accessibilityState={accessibilityState}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        {
          backgroundColor,
          borderColor: theme.primary,
          borderWidth: secondary ? 1 : 0,
          opacity: chooseActionOpacity(disabled, pressed)
        }
      ]}
    >
      <Text style={[styles.actionText, { color: textColor }]}>
        {selected ? "✓ " : ""}
        {label}
      </Text>
    </Pressable>
  );
}

export function RouteAction({ label, accessibilityLabel, href, secondary = false }: {
  label: string;
  accessibilityLabel?: string;
  href: Href;
  secondary?: boolean
}) {
  const theme = useTheme();

  return (
    <Link href={href} asChild>
      <TouchableOpacity
        accessibilityRole="link"
        accessibilityLabel={accessibilityLabel ?? label}
        activeOpacity={0.75}
        style={StyleSheet.flatten([
          styles.action,
          {
            backgroundColor: secondary ? theme.surface : theme.primary,
            borderColor: theme.primary,
            borderWidth: secondary ? 2 : 0
          }
        ])}
      >
        <Text style={[styles.actionText, { color: secondary ? theme.primary : theme.primaryText }]}>{label}</Text>
      </TouchableOpacity>
    </Link>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  disabled = false,
  role = "radio"
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  role?: "button" | "checkbox" | "radio"
}) {
  const theme = useTheme();
  const accessibilityState = role === "button" ? { disabled, selected } : { checked: selected, disabled };

  return (
    <Pressable
      disabled={disabled}
      accessibilityRole={role}
      accessibilityLabel={label}
      accessibilityState={accessibilityState}
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? theme.accent : theme.surface,
          borderColor: selected ? theme.accent : theme.border,
          opacity: disabled ? 0.6 : 1
        }
      ]}
    >
      <Text style={[styles.chipText, { color: selected ? "#182027" : theme.text }]}>
        {selected ? "✓ " : ""}
        {label}
      </Text>
    </Pressable>
  );
}

export function Row({ children }: { children: ReactNode }) {
  return (
    <View style={styles.row}>
      {children}
    </View>
  );
}

export function Formula({ activeStep }: { activeStep?: number } = {}) {
  const theme = useTheme();
  const intervals = ["T", "T", "½", "T", "T", "T", "½"];
  let accessibilityLabel = "Ton, ton, demi-ton, ton, ton, ton, demi-ton";

  if (activeStep !== undefined) {
    const activeInterval = intervals[activeStep] === "T" ? "un ton" : "un demi-ton";
    accessibilityLabel += `. Étape ${activeStep + 1} : ${activeInterval}`;
  }

  return (
    <Text accessibilityLabel={accessibilityLabel} style={[styles.formula, { color: theme.primary }]}>
      {intervals.map((interval, index) => {
        let separator = "";

        if (index > 0) separator = index === 3 ? " | " : " – ";

        return (
          <Text key={index}>
            {separator}
            <Text style={activeStep === index ? { backgroundColor: theme.accent, color: "#182027" } : undefined}>
              {interval}
            </Text>
          </Text>
        );
      })}
    </Text>
  );
}

export function Notice({ children, danger = false }: PropsWithChildren<{ danger?: boolean }>) {
  const theme = useTheme();

  return (
    <View accessibilityLiveRegion="polite" style={[styles.notice, { borderColor: danger ? theme.danger : theme.primary }]}>
      <Text style={[styles.body, { color: danger ? theme.danger : theme.text }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    gap: 16,
    padding: 20,
    paddingBottom: 40
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -0.6
  },
  subtitle: {
    fontSize: 17,
    lineHeight: 24,
    marginTop: 6
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
    padding: 18
  },
  heading: { fontSize: 21, fontWeight: "700" },
  body: { fontSize: 16, lineHeight: 24 },
  action: {
    alignItems: "center",
    borderRadius: 14,
    flexShrink: 1,
    justifyContent: "center",
    maxWidth: "100%",
    minHeight: 50,
    paddingHorizontal: 18,
    paddingVertical: 12
  },
  actionText: {
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center"
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  chip: {
    borderRadius: 14,
    borderWidth: 2,
    flexShrink: 1,
    justifyContent: "center",
    maxWidth: "100%",
    minHeight: 48,
    minWidth: 76,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  chipText: {
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center"
  },
  formula: {
    fontSize: 24,
    fontWeight: "800",
    lineHeight: 34,
    textAlign: "center"
  },
  notice: {
    borderLeftWidth: 4,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
});
