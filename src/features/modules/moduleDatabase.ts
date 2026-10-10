import Dexie, { type Table } from "dexie";
import type { MaterialRecord, StoredFileRecord } from "../materials/material";
import type { ModuleRecord } from "./module";
import type { TopicRecord } from "../topics/topic";
import type { NoteRecord } from "../notes/note";
import type { TaskRecord } from "../tasks/task";
import type { StudySessionRecord } from "../studySessions/studySession";
import type { AppSettingRecord } from "../settings/appSetting";

export class ModuleDatabase extends Dexie {
  modules!: Table<ModuleRecord, string>;
  topics!: Table<TopicRecord, string>;
  materials!: Table<MaterialRecord, string>;
  storedFiles!: Table<StoredFileRecord, string>;
  notes!: Table<NoteRecord, string>;
  tasks!: Table<TaskRecord, string>;
  studySessions!: Table<StudySessionRecord, string>;
  appSettings!: Table<AppSettingRecord, string>;

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
    this.version(3).stores({
      modules: "id, &code, name, semester, academicYear, isArchived, updatedAt",
      topics: "id, moduleId, sortOrder, updatedAt",
      materials:
        "id, title, originalFileName, moduleId, topicId, *tags, status, isFavorite, createdAt, updatedAt, lastOpenedAt",
      storedFiles: "id",
    });
    this.version(4).stores({
      modules: "id, &code, name, semester, academicYear, isArchived, updatedAt",
      topics: "id, moduleId, sortOrder, updatedAt",
      materials:
        "id, title, originalFileName, moduleId, topicId, *tags, status, isFavorite, createdAt, updatedAt, lastOpenedAt",
      storedFiles: "id",
      notes: "id, title, *tags, isPinned, updatedAt",
    });
    this.version(5).stores({
      modules: "id, &code, name, semester, academicYear, isArchived, updatedAt",
      topics: "id, moduleId, sortOrder, updatedAt",
      materials:
        "id, title, originalFileName, moduleId, topicId, *tags, status, isFavorite, createdAt, updatedAt, lastOpenedAt",
      storedFiles: "id",
      notes: "id, title, *tags, isPinned, updatedAt",
      tasks: "id, moduleId, topicId, dueAt, priority, status, type, *linkedMaterialIds, *tags, createdAt, updatedAt",
    });
    this.version(6).stores({
      modules: "id, &code, name, semester, academicYear, isArchived, updatedAt",
      topics: "id, moduleId, sortOrder, updatedAt",
      materials:
        "id, title, originalFileName, moduleId, topicId, *tags, status, isFavorite, createdAt, updatedAt, lastOpenedAt",
      storedFiles: "id",
      notes: "id, title, *tags, isPinned, updatedAt",
      tasks: "id, moduleId, topicId, dueAt, priority, status, type, *linkedMaterialIds, *tags, createdAt, updatedAt",
      studySessions: "id, moduleId, topicId, materialId, plannedStart, status, createdAt, updatedAt",
    });
    this.version(7).stores({
      modules: "id, &code, name, semester, academicYear, isArchived, updatedAt",
      topics: "id, moduleId, sortOrder, updatedAt",
      materials:
        "id, title, originalFileName, moduleId, topicId, *tags, status, isFavorite, createdAt, updatedAt, lastOpenedAt",
      storedFiles: "id",
      notes: "id, title, *tags, isPinned, updatedAt",
      tasks: "id, moduleId, topicId, dueAt, priority, status, type, *linkedMaterialIds, *tags, createdAt, updatedAt",
      studySessions: "id, moduleId, topicId, materialId, plannedStart, status, createdAt, updatedAt",
      appSettings: "id",
    });
  }
}

export const moduleDatabase = new ModuleDatabase();
