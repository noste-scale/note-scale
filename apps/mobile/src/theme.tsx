import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, type PropsWithChildren, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useColorScheme } from "react-native";
import { createSerializedSaver } from "./progress-state";
import { nextThemePreference, shouldApplyStoredPreference, type ThemePreference } from "./theme-state";

export const light = {
  background: "#F7F4EC", surface: "#FFFFFF", text: "#182027", muted: "#53616A", primary: "#155E75",
  primaryText: "#FFFFFF", accent: "#F2B84B", border: "#CBD5D8", success: "#166534", danger: "#B42318", focus: "#7C3AED",
} as const;

export const dark = {
  background: "#101619", surface: "#182126", text: "#F4F7F8", muted: "#B7C3C8", primary: "#67E8F9",
  primaryText: "#083344", accent: "#F6C85F", border: "#405057", success: "#86EFAC", danger: "#FDA29B", focus: "#C4B5FD",
} as const;

export type Theme = typeof light | typeof dark;
interface ThemeContextValue { theme: Theme; preference: ThemePreference; cyclePreference: () => void }
const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: PropsWithChildren) {
  const system = useColorScheme();
  const [preference, setPreference] = useState<ThemePreference>("system");
  const preferenceRef = useRef<ThemePreference>("system");
  const revision = useRef(0);
  const savePreference = useRef(createSerializedSaver(
    (value: ThemePreference) => AsyncStorage.setItem("notescale.theme", value),
  )).current;
  useEffect(() => {
    const loadRevision = revision.current;
    AsyncStorage.getItem("notescale.theme").then((value) => {
      if (shouldApplyStoredPreference(loadRevision, revision.current) && (value === "system" || value === "light" || value === "dark")) {
        preferenceRef.current = value;
        setPreference(value);
      }
    }).catch(() => undefined);
  }, []);
  const cyclePreference = () => {
    revision.current += 1;
    const next = nextThemePreference(preferenceRef.current);
    preferenceRef.current = next;
    setPreference(next);
    void savePreference(next).catch(() => undefined);
  };
  const theme = preference === "dark" || (preference === "system" && system === "dark") ? dark : light;
  const value = useMemo(() => ({ theme, preference, cyclePreference }), [preference, theme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const context = useContext(ThemeContext);
  const system = useColorScheme();
  return context?.theme ?? (system === "dark" ? dark : light);
}

export function useThemePreference(): Pick<ThemeContextValue, "preference" | "cyclePreference"> {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useThemePreference must be used inside ThemeProvider");
  return context;
}
