export type ThemePreference = "system" | "light" | "dark";

export function shouldApplyStoredPreference(loadRevision: number, currentRevision: number): boolean {
  return loadRevision === currentRevision;
}

const NEXT_THEME_PREFERENCE: Record<ThemePreference, ThemePreference> = {
  system: "light",
  light: "dark",
  dark: "system",
};

export function nextThemePreference(current: ThemePreference): ThemePreference {
  return NEXT_THEME_PREFERENCE[current] ?? "system";
}
