import Dexie, { type Table } from "dexie";
import type { MaterialRecord, StoredFileRecord } from "../materials/material";
import type { ModuleRecord } from "./module";
import type { TopicRecord } from "../topics/topic";

export class ModuleDatabase extends Dexie {
  modules!: Table<ModuleRecord, string>;
  topics!: Table<TopicRecord, string>;
  materials!: Table<MaterialRecord, string>;
  storedFiles!: Table<StoredFileRecord, string>;

  constructor(name = "CollegeStudyHub") {
    super(name);
    this.version(1).stores({
      modules: "id, &code, name, semester, academicYear, isArchived, updatedAt",
    });
    this.version(2)
      .stores({
        modules: "id, &code, name, semester, academicYear, isArchived, updatedAt",
        topics: "id, moduleId, sortOrder, updatedAt",
        materials:
          "id, title, originalFileName, moduleId, topicId, *tags, status, isFavorite, createdAt, updatedAt",
        storedFiles: "id",
      })
      .upgrade(async (transaction) => {
        await transaction.table("modules").toCollection().modify((module) => {
          module.isArchived ??= false;
        });
      });
  }
}

export const moduleDatabase = new ModuleDatabase();
