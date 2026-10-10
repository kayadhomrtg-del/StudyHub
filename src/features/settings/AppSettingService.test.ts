import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ModuleDatabase } from "../modules/moduleDatabase";
import { AppSettingRepository } from "./AppSettingRepository";
import { AppSettingService } from "./AppSettingService";

describe("AppSettingService", () => {
  let database: ModuleDatabase;
  let service: AppSettingService;

  beforeEach(async () => {
    database = new ModuleDatabase(`app-setting-test-${crypto.randomUUID()}`);
    await database.open();
    service = new AppSettingService(new AppSettingRepository(database));
  });

  afterEach(async () => {
    database.close();
    await database.delete();
  });

  it("defaults to light and persists the chosen theme across a database reopen", async () => {
    await expect(service.getTheme()).resolves.toBe("light");
    await service.setTheme("dark");
    const databaseName = database.name;
    database.close();

    database = new ModuleDatabase(databaseName);
    await database.open();
    service = new AppSettingService(new AppSettingRepository(database));

    await expect(service.getTheme()).resolves.toBe("dark");
    await expect(service.getAll()).resolves.toEqual([{ id: "appearance", theme: "dark" }]);
  });
});
