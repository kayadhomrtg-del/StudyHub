export type ThemePreference = "light" | "dark";

export interface AppSettingRecord {
  id: "appearance";
  theme: ThemePreference;
}
