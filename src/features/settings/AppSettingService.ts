import { moduleDatabase } from "../modules/moduleDatabase";
import { AppSettingRepository } from "./AppSettingRepository";
import type { AppSettingRecord, ThemePreference } from "./appSetting";

export class AppSettingService {
  constructor(private readonly repository: AppSettingRepository) {}

  getTheme(): Promise<ThemePreference> {
    return this.repository.getTheme();
  }

  setTheme(theme: ThemePreference): Promise<void> {
    if (theme !== "light" && theme !== "dark") {
      throw new Error("Choose a supported appearance.");
    }
    return this.repository.setTheme(theme);
  }

  getAll(): Promise<AppSettingRecord[]> {
    return this.repository.getAll();
  }
}

export const appSettingService = new AppSettingService(new AppSettingRepository(moduleDatabase));
