import type { ModuleDatabase } from "../modules/moduleDatabase";
import type { AppSettingRecord, ThemePreference } from "./appSetting";

export class AppSettingRepository {
  constructor(private readonly database: ModuleDatabase) {}

  async getTheme(): Promise<ThemePreference> {
    const setting = await this.database.appSettings.get("appearance");
    return setting?.theme ?? "light";
  }

  async setTheme(theme: ThemePreference): Promise<void> {
    const record: AppSettingRecord = { id: "appearance", theme };
    await this.database.appSettings.put(record);
  }

  getAll(): Promise<AppSettingRecord[]> {
    return this.database.appSettings.toArray();
  }
}
