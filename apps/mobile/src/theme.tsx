import type { StorageAdapter } from "@notescale/music";
import { createContext, type PropsWithChildren, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useColorScheme } from "react-native";
import { createSerializedSaver } from "./progress-state";
import { nextThemePreference, shouldApplyStoredPreference, type ThemePreference } from "./theme-state";

export const light = {
  background: "#F7F4EC",
  surface: "#FFFFFF",
  text: "#182027",
  muted: "#53616A",
  primary: "#155E75",
  primaryText: "#FFFFFF",
  accent: "#F2B84B",
  border: "#CBD5D8",
  success: "#166534",
  danger: "#B42318",
  focus: "#7C3AED",
} as const;

export const dark = {
  background: "#101619",
  surface: "#182126",
  text: "#F4F7F8",
  muted: "#B7C3C8",
  primary: "#67E8F9",
  primaryText: "#083344",
  accent: "#F6C85F",
  border: "#405057",
  success: "#86EFAC",
  danger: "#FDA29B",
  focus: "#C4B5FD",
} as const;

export type Theme = typeof light | typeof dark;
interface ThemeContextValue { theme: Theme; preference: ThemePreference; cyclePreference: () => void }
const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children, storage: suppliedStorage }: PropsWithChildren<{ storage: StorageAdapter }>) {
  const storage = useRef(suppliedStorage).current;
  const systemColorScheme = useColorScheme();
  const [preference, setPreference] = useState<ThemePreference>("system");
  const preferenceRef = useRef<ThemePreference>("system");
  const preferenceRevision = useRef(0);
  const savePreference = useRef(createSerializedSaver(
    async (value: ThemePreference) => storage.setItem("notescale.theme", value),
  )).current;
  useEffect(() => {
    let isEffectActive = true;
    const loadRevision = preferenceRevision.current;
    Promise.resolve().then(() => storage.getItem("notescale.theme")).then((storedPreference) => {
      if (isEffectActive && shouldApplyStoredPreference(loadRevision, preferenceRevision.current) && (storedPreference === "system" || storedPreference === "light" || storedPreference === "dark")) {
        preferenceRef.current = storedPreference;
        setPreference(storedPreference);
      }
    }).catch(() => undefined);
    return () => { isEffectActive = false; };
  }, [storage]);
  const cyclePreference = () => {
    preferenceRevision.current += 1;
    const nextPreference = nextThemePreference(preferenceRef.current);
    preferenceRef.current = nextPreference;
    setPreference(nextPreference);
    void savePreference(nextPreference).catch(() => undefined);
  };
  const theme = preference === "dark" || (preference === "system" && systemColorScheme === "dark") ? dark : light;
  const contextValue = useMemo(() => ({ theme, preference, cyclePreference }), [preference, theme]);
  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): Theme {
  const themeContext = useContext(ThemeContext);
  const systemColorScheme = useColorScheme();
  return themeContext?.theme ?? (systemColorScheme === "dark" ? dark : light);
}

export function useThemePreference(): Pick<ThemeContextValue, "preference" | "cyclePreference"> {
  const themeContext = useContext(ThemeContext);
  if (!themeContext) throw new Error("useThemePreference must be used inside ThemeProvider");
  return themeContext;
}
