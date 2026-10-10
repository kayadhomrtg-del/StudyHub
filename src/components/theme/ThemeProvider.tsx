import {
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import { ThemeContext } from "./themeContext";
import { appSettingService } from "../../features/settings/AppSettingService";

type Theme = "light" | "dark";

export function ThemeProvider({ children }: PropsWithChildren) {
  const [theme, setTheme] = useState<Theme>("light");
  const [settingsReady, setSettingsReady] = useState(false);
  const [settingsError, setSettingsError] = useState("");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    if (settingsReady) {
      void appSettingService.setTheme(theme).catch((error: unknown) => {
        setSettingsError(error instanceof Error ? error.message : "Appearance could not be saved locally.");
      });
    }
  }, [settingsReady, theme]);

  useEffect(() => {
    void appSettingService.getTheme().then((savedTheme) => {
      setTheme(savedTheme);
      setSettingsReady(true);
    }).catch((error: unknown) => {
      setSettingsError(error instanceof Error ? error.message : "Saved appearance could not be loaded.");
      setSettingsReady(true);
    });
  }, []);

  const value = useMemo(
    () => ({
      theme,
      toggleTheme: () =>
        setTheme((currentTheme) => (currentTheme === "light" ? "dark" : "light")),
    }),
    [theme],
  );

  return (
    <ThemeContext.Provider value={value}>
      {settingsError && <p className="fixed bottom-3 right-3 z-[100] max-w-sm rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-900 shadow-lg" role="alert">{settingsError}</p>}
      {children}
    </ThemeContext.Provider>
  );
}
