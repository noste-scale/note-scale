export type ThemePreference = "system" | "light" | "dark";

export function shouldApplyStoredPreference(loadRevision: number, currentRevision: number): boolean {
  return loadRevision === currentRevision;
}

export function nextThemePreference(current: ThemePreference): ThemePreference {
  return current === "system" ? "light" : current === "light" ? "dark" : "system";
}
