import type { MaterialRecord, StoredFileRecord } from "../materials/material";
import type { ModuleDatabase } from "../modules/moduleDatabase";
import type { ModuleRecord } from "../modules/module";
import type { TopicRecord } from "../topics/topic";
import type { NoteRecord } from "../notes/note";
import type { TaskRecord } from "../tasks/task";
import { taskPriorities, taskStatuses, taskTypes } from "../tasks/task";
import type { StudySessionRecord } from "../studySessions/studySession";
import type { AppSettingRecord } from "../settings/appSetting";
import { inspectZipArchive } from "../archive/zipSafety";

const backupFormat = "college-study-hub-backup";
const backupVersion = 2;
const oldestSupportedBackupVersion = 1;
export const maxBackupBytes = 512 * 1024 * 1024;
const maxBackupRecordsBytes = 64 * 1024 * 1024;
const maxBackupEntries = 10_002;

export interface BackupRecords {
  modules: ModuleRecord[];
  topics: TopicRecord[];
  materials: MaterialRecord[];
  notes: NoteRecord[];
  tasks: TaskRecord[];
  studySessions: StudySessionRecord[];
  settings: AppSettingRecord[];
}

interface BackupManifest {
  format: typeof backupFormat;
  version: number;
  appVersion?: string;
  kind: "full" | "module";
  exportedAt: string;
  counts: Record<string, number>;
  files?: Array<{ id: string; name: string; mimeType: string; sizeBytes: number }>;
}

export type RestoreMode = "merge" | "replace";

export interface RestoreSummary {
  modules: number;
  topics: number;
  materials: number;
  notes: number;
  tasks: number;
  studySessions: number;
  settings: number;
  files: number;
  bytes: number;
  totalBytes: number;
}

interface ParsedBackup {
  records: BackupRecords;
  files: StoredFileRecord[];
  kind: BackupManifest["kind"];
  version: number;
  appVersion?: string;
  exportedAt: string;
  totalBytes: number;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validTimestamp(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function validateRecords(value: unknown, legacyVersion = false): BackupRecords {
  if (!isObject(value)) throw new Error("The backup records section is missing or invalid.");
  const modules = value.modules;
  const topics = value.topics;
  const materials = value.materials;
  const notes = legacyVersion ? [] : value.notes;
  const tasks = legacyVersion ? [] : value.tasks;
  const studySessions = legacyVersion ? [] : value.studySessions;
  const settings = legacyVersion ? [] : value.settings;
  if (
    !Array.isArray(modules) || !Array.isArray(topics) || !Array.isArray(materials) ||
    !Array.isArray(notes) || !Array.isArray(tasks) || !Array.isArray(studySessions) ||
    !Array.isArray(settings)
  ) {
    throw new Error("The backup is missing one or more required record tables.");
  }

  const uniqueIds = <T extends { id: string }>(records: T[], label: string) => {
    const ids = new Set<string>();
    for (const record of records) {
      if (!isObject(record) || typeof record.id !== "string" || !/^[\w-]{1,128}$/.test(record.id)) {
        throw new Error(`A ${label} record has an invalid ID.`);
      }
      if (ids.has(record.id)) throw new Error(`The backup contains duplicate ${label} IDs.`);
      ids.add(record.id);
    }
  };
  uniqueIds(modules, "module");
  uniqueIds(topics, "topic");
  uniqueIds(materials, "material");
  uniqueIds(notes, "note");
  uniqueIds(tasks, "task");
  uniqueIds(studySessions, "study session");
  uniqueIds(settings, "setting");

  const validModules = modules as ModuleRecord[];
  const validTopics = topics as TopicRecord[];
  const validMaterials = materials as MaterialRecord[];
  const validNotes = notes as NoteRecord[];
  const validTasks = tasks as TaskRecord[];
  const validSessions = studySessions as StudySessionRecord[];
  const validSettings = settings as AppSettingRecord[];
  const moduleIds = new Set(validModules.map((module) => module.id));
  const topicIds = new Set(validTopics.map((topic) => topic.id));
  const materialIds = new Set(validMaterials.map((material) => material.id));
  const taskIds = new Set(validTasks.map((task) => task.id));
  const codes = new Set<string>();
  for (const module of validModules) {
    if (
      typeof module.name !== "string" ||
      !module.name.trim() ||
      module.name.length > 100 ||
      typeof module.code !== "string" ||
      !module.code.trim() ||
      module.code.length > 30 ||
      typeof module.isArchived !== "boolean" ||
      !validTimestamp(module.createdAt) ||
      !validTimestamp(module.updatedAt) ||
      (module.semester !== undefined && (typeof module.semester !== "string" || module.semester.length > 50)) ||
      (module.academicYear !== undefined && (typeof module.academicYear !== "string" || module.academicYear.length > 20)) ||
      (module.lecturer !== undefined && (typeof module.lecturer !== "string" || module.lecturer.length > 120)) ||
      (module.description !== undefined && (typeof module.description !== "string" || module.description.length > 2000)) ||
      (module.color !== undefined && (typeof module.color !== "string" || !/^#[\da-f]{6}$/i.test(module.color)))
    ) throw new Error("The backup contains an invalid module record.");
    const code = module.code.trim().toLocaleLowerCase();
    if (codes.has(code)) throw new Error(`The backup contains duplicate module code “${module.code}”.`);
    codes.add(code);
  }
  for (const topic of validTopics) {
    if (
      !moduleIds.has(topic.moduleId) ||
      typeof topic.title !== "string" ||
      !topic.title.trim() ||
      topic.title.length > 200 ||
      !Number.isInteger(topic.sortOrder) ||
      !validTimestamp(topic.createdAt) ||
      !validTimestamp(topic.updatedAt) ||
      (topic.description !== undefined && (typeof topic.description !== "string" || topic.description.length > 2000))
    ) throw new Error("The backup contains a topic with invalid data or a missing module.");
  }
  for (const material of validMaterials) {
    if (
      typeof material.originalFileName !== "string" ||
      !material.originalFileName ||
      typeof material.title !== "string" ||
      material.title.length > 200 ||
      typeof material.mimeType !== "string" ||
      !Number.isSafeInteger(material.sizeBytes) ||
      material.sizeBytes < 0 ||
      !Array.isArray(material.tags) ||
      material.tags.some((tag) => typeof tag !== "string") ||
      typeof material.isFavorite !== "boolean" ||
      !["not-started", "in-progress", "completed"].includes(material.status) ||
      !validTimestamp(material.createdAt) ||
      !validTimestamp(material.updatedAt) ||
      (material.lastOpenedAt !== undefined && !validTimestamp(material.lastOpenedAt)) ||
      (material.extension !== undefined && typeof material.extension !== "string") ||
      (material.moduleId !== undefined && !moduleIds.has(material.moduleId)) ||
      (material.topicId !== undefined && !topicIds.has(material.topicId))
    ) throw new Error("The backup contains invalid material metadata or a broken relationship.");
    if (material.topicId) {
      const topic = validTopics.find((item) => item.id === material.topicId);
      if (!topic || topic.moduleId !== material.moduleId) {
        throw new Error("A material points to a topic outside its assigned module.");
      }
    }
  }
  for (const note of validNotes) {
    if (
      typeof note.title !== "string" || note.title.length > 200 ||
      typeof note.markdown !== "string" || note.markdown.length > 1_000_000 ||
      !Array.isArray(note.tags) || note.tags.length > 30 ||
      note.tags.some((tag) => typeof tag !== "string" || tag.length > 50) ||
      typeof note.isPinned !== "boolean" ||
      !validTimestamp(note.createdAt) || !validTimestamp(note.updatedAt) ||
      (note.link !== undefined && (
        !isObject(note.link) ||
        typeof note.link.id !== "string" ||
        (note.link.label !== undefined && typeof note.link.label !== "string") ||
        !(
          (note.link.type === "module" && moduleIds.has(note.link.id)) ||
          (note.link.type === "topic" && topicIds.has(note.link.id)) ||
          (note.link.type === "material" && materialIds.has(note.link.id)) ||
          (note.link.type === "task" && taskIds.has(note.link.id))
        )
      ))
    ) throw new Error("The backup contains an invalid note or a broken note link.");
  }
  for (const task of validTasks) {
    if (
      typeof task.title !== "string" || !task.title.trim() || task.title.length > 200 ||
      typeof task.description !== "string" || task.description.length > 10_000 ||
      !taskPriorities.includes(task.priority) || !taskStatuses.includes(task.status) ||
      !taskTypes.includes(task.type) ||
      !Array.isArray(task.tags) || task.tags.length > 30 ||
      task.tags.some((tag) => typeof tag !== "string" || tag.length > 50) ||
      !Array.isArray(task.linkedMaterialIds) ||
      task.linkedMaterialIds.some((id) => typeof id !== "string" || !materialIds.has(id)) ||
      new Set(task.linkedMaterialIds).size !== task.linkedMaterialIds.length ||
      !validTimestamp(task.createdAt) || !validTimestamp(task.updatedAt) ||
      (task.dueAt !== undefined && !validTimestamp(task.dueAt)) ||
      (task.completedAt !== undefined && !validTimestamp(task.completedAt)) ||
      (task.moduleId !== undefined && !moduleIds.has(task.moduleId)) ||
      (task.topicId !== undefined && !topicIds.has(task.topicId))
    ) throw new Error("The backup contains an invalid task or a broken task link.");
    if (task.topicId) {
      const topic = validTopics.find((item) => item.id === task.topicId);
      if (!topic || topic.moduleId !== task.moduleId) {
        throw new Error("A task points to a topic outside its assigned module.");
      }
    }
  }
  for (const session of validSessions) {
    if (
      typeof session.title !== "string" || !session.title.trim() || session.title.length > 200 ||
      !validTimestamp(session.plannedStart) ||
      !Number.isInteger(session.plannedDurationMinutes) || session.plannedDurationMinutes < 1 ||
      !["planned", "completed", "skipped"].includes(session.status) ||
      (session.actualDurationMinutes !== null &&
        (!Number.isInteger(session.actualDurationMinutes) || session.actualDurationMinutes < 0)) ||
      (session.goal !== undefined && (typeof session.goal !== "string" || session.goal.length > 2000)) ||
      !validTimestamp(session.createdAt) || !validTimestamp(session.updatedAt) ||
      (session.moduleId !== undefined && !moduleIds.has(session.moduleId)) ||
      (session.topicId !== undefined && !topicIds.has(session.topicId)) ||
      (session.materialId !== undefined && !materialIds.has(session.materialId))
    ) throw new Error("The backup contains an invalid study session or a broken session link.");
    if (session.topicId) {
      const topic = validTopics.find((item) => item.id === session.topicId);
      if (!topic || topic.moduleId !== session.moduleId) {
        throw new Error("A study session points to a topic outside its assigned module.");
      }
    }
    if (session.materialId) {
      const material = validMaterials.find((item) => item.id === session.materialId);
      if (material?.moduleId && session.moduleId && material.moduleId !== session.moduleId) {
        throw new Error("A study session links to a material outside its assigned module.");
      }
    }
  }
  for (const setting of validSettings) {
    if (!isObject(setting) || setting.id !== "appearance" || !["light", "dark"].includes(setting.theme)) {
      throw new Error("The backup contains an unsupported application setting.");
    }
  }
  return {
    modules: validModules,
    topics: validTopics,
    materials: validMaterials,
    notes: validNotes,
    tasks: validTasks,
    studySessions: validSessions,
    settings: validSettings,
  };
}

async function parseBackup(bytes: ArrayBuffer): Promise<ParsedBackup> {
  if (bytes.byteLength === 0 || bytes.byteLength > maxBackupBytes) {
    throw new Error("The backup file is empty or exceeds the 512 MiB import limit.");
  }
  let zipEntries: ReturnType<typeof inspectZipArchive>;
  try {
    zipEntries = inspectZipArchive(bytes, {
      maxEntries: maxBackupEntries,
      maxExpandedBytes: maxBackupBytes + maxBackupRecordsBytes + 64 * 1024,
    });
  } catch (error) {
    throw new Error(
      `This file is not a readable backup archive: ${error instanceof Error ? error.message : "invalid ZIP data"}`,
    );
  }
  if (
    (zipEntries.get("manifest.json")?.expandedBytes ?? Infinity) > 64 * 1024 ||
    (zipEntries.get("records.json")?.expandedBytes ?? Infinity) > maxBackupRecordsBytes
  ) {
    throw new Error("The backup metadata exceeds its safe import limit.");
  }
  const { default: JSZip } = await import("jszip");
  let archive: Awaited<ReturnType<typeof JSZip.loadAsync>>;
  try {
    archive = await JSZip.loadAsync(bytes, { checkCRC32: true });
  } catch (error) {
    throw new Error(`This file is not a readable backup archive: ${error instanceof Error ? error.message : "invalid ZIP data"}`);
  }
  const manifestFile = archive.file("manifest.json");
  const recordsFile = archive.file("records.json");
  if (!manifestFile || !recordsFile) throw new Error("The backup is missing its manifest or records file.");

  let manifest: unknown;
  try {
    manifest = JSON.parse(await manifestFile.async("string")) as unknown;
  } catch {
    throw new Error("The backup manifest is not valid JSON.");
  }
  if (
    !isObject(manifest) ||
    manifest.format !== backupFormat ||
    !Number.isInteger(manifest.version) ||
    Number(manifest.version) < oldestSupportedBackupVersion ||
    Number(manifest.version) > backupVersion ||
    !["full", "module"].includes(String(manifest.kind)) ||
    !validTimestamp(manifest.exportedAt)
  ) throw new Error("This backup format or version is not supported.");
  const version = Number(manifest.version);
  if (version === backupVersion && (typeof manifest.appVersion !== "string" || !isObject(manifest.counts))) {
    throw new Error("The backup manifest is missing its application version or record counts.");
  }
  if (manifest.appVersion !== undefined && typeof manifest.appVersion !== "string") {
    throw new Error("The backup manifest contains an invalid application version.");
  }

  let recordsValue: unknown;
  try {
    recordsValue = JSON.parse(await recordsFile.async("string")) as unknown;
  } catch {
    throw new Error("The backup records file is not valid JSON.");
  }
  const records = validateRecords(recordsValue, version === 1);
  if (manifest.kind === "module" && records.modules.length !== 1) {
    throw new Error("A module backup must contain exactly one module record.");
  }
  const fileMetadata = version === 1 ? records.materials.map((material) => ({
    id: material.id,
    name: material.originalFileName,
    mimeType: material.mimeType,
    sizeBytes: material.sizeBytes,
  })) : manifest.files;
  if (!Array.isArray(fileMetadata)) {
    throw new Error("The backup manifest is missing its original file metadata.");
  }
  const metadataById = new Map<string, { id: string; name: string; mimeType: string; sizeBytes: number }>();
  for (const file of fileMetadata) {
    if (
      !isObject(file) ||
      typeof file.id !== "string" ||
      typeof file.name !== "string" ||
      typeof file.mimeType !== "string" ||
      !Number.isSafeInteger(file.sizeBytes) ||
      Number(file.sizeBytes) < 0 ||
      metadataById.has(file.id)
    ) throw new Error("The backup manifest contains invalid or duplicate file metadata.");
    metadataById.set(file.id, file as { id: string; name: string; mimeType: string; sizeBytes: number });
  }
  if (
    metadataById.size !== records.materials.length ||
    records.materials.some((material) => {
      const metadata = metadataById.get(material.id);
      return !metadata ||
        metadata.name !== material.originalFileName ||
        metadata.mimeType !== material.mimeType ||
        metadata.sizeBytes !== material.sizeBytes;
    })
  ) throw new Error("The backup file metadata does not match its material records.");
  const expectedEntries = new Set([
    "manifest.json",
    "records.json",
    ...records.materials.map((material) => `files/${material.id}.bin`),
  ]);
  for (const [path, entry] of Object.entries(archive.files)) {
    if (entry.dir) {
      if (path !== "files/") throw new Error("The backup contains an unexpected directory entry.");
    } else if (!expectedEntries.has(path)) {
      throw new Error(`The backup contains an unreferenced entry “${path}”.`);
    }
  }
  const files: StoredFileRecord[] = [];
  let totalBytes = 0;
  for (const material of records.materials) {
    const fileEntry = archive.file(`files/${material.id}.bin`);
    if (!fileEntry || fileEntry.dir) {
      throw new Error(`The backup does not contain the original file for “${material.originalFileName}”.`);
    }
    const fileBytes = await fileEntry.async("arraybuffer");
    totalBytes += fileBytes.byteLength;
    if (totalBytes > maxBackupBytes || fileBytes.byteLength !== material.sizeBytes) {
      throw new Error(`The stored file for “${material.originalFileName}” is oversized or does not match its metadata.`);
    }
    files.push({ id: material.id, bytes: fileBytes });
  }
  const expectedCounts = {
    modules: records.modules.length,
    topics: records.topics.length,
    materials: records.materials.length,
    notes: records.notes.length,
    tasks: records.tasks.length,
    studySessions: records.studySessions.length,
    settings: records.settings.length,
    storedFiles: files.length,
  };
  const manifestCounts = manifest.counts;
  const comparedCounts = version === 1
    ? { modules: expectedCounts.modules, topics: expectedCounts.topics, materials: expectedCounts.materials }
    : expectedCounts;
  if (!isObject(manifestCounts) || Object.entries(comparedCounts).some(([key, count]) => manifestCounts[key] !== count)) {
    throw new Error("The backup manifest record counts do not match the records file.");
  }
  return {
    records,
    files,
    kind: manifest.kind as BackupManifest["kind"],
    version,
    ...(typeof manifest.appVersion === "string" ? { appVersion: manifest.appVersion } : {}),
    exportedAt: manifest.exportedAt,
    totalBytes: bytes.byteLength,
  };
}

export class BackupService {
  constructor(private readonly database: ModuleDatabase) {}

  async createFullBackup(): Promise<ArrayBuffer> {
    return this.createFullBackupV2();
  }

  async createModuleBackup(moduleId: string): Promise<ArrayBuffer> {
    return this.createBackup("module", moduleId);
  }

  private async createFullBackupV2(): Promise<ArrayBuffer> {
    const snapshot = await this.database.transaction(
      "r",
      [
        this.database.modules,
        this.database.topics,
        this.database.materials,
        this.database.storedFiles,
        this.database.notes,
        this.database.tasks,
        this.database.studySessions,
        this.database.appSettings,
      ],
      async () => ({
        records: {
          modules: await this.database.modules.toArray(),
          topics: await this.database.topics.toArray(),
          materials: await this.database.materials.toArray(),
          notes: await this.database.notes.toArray(),
          tasks: await this.database.tasks.toArray(),
          studySessions: await this.database.studySessions.toArray(),
          settings: await this.database.appSettings.toArray(),
        },
        files: await this.database.storedFiles.toArray(),
      }),
    );
    const records = validateRecords(snapshot.records);
    const filesById = new Map(snapshot.files.map((file) => [file.id, file]));
    if (filesById.size !== records.materials.length) {
      throw new Error("The local file store contains missing or unreferenced file records. Nothing was omitted from the backup.");
    }
    let fileBytesTotal = 0;
    const fileMetadata: NonNullable<BackupManifest["files"]> = [];
    const { default: JSZip } = await import("jszip");
    const archive = new JSZip();
    for (const material of records.materials) {
      const file = filesById.get(material.id);
      if (!file || file.bytes.byteLength !== material.sizeBytes) {
        throw new Error(`The original file for “${material.originalFileName}” is missing or damaged. Nothing was skipped in the backup.`);
      }
      fileBytesTotal += file.bytes.byteLength;
      if (fileBytesTotal > maxBackupBytes) {
        throw new Error("The backup would exceed the 512 MiB export limit.");
      }
      archive.file(`files/${material.id}.bin`, file.bytes.slice(0));
      fileMetadata.push({
        id: material.id,
        name: material.originalFileName,
        mimeType: material.mimeType,
        sizeBytes: file.bytes.byteLength,
      });
    }
    const counts = {
      modules: records.modules.length,
      topics: records.topics.length,
      materials: records.materials.length,
      notes: records.notes.length,
      tasks: records.tasks.length,
      studySessions: records.studySessions.length,
      settings: records.settings.length,
      storedFiles: snapshot.files.length,
    };
    const manifest: BackupManifest = {
      format: backupFormat,
      version: backupVersion,
      appVersion: __APP_VERSION__,
      kind: "full",
      exportedAt: new Date().toISOString(),
      counts,
      files: fileMetadata,
    };
    const recordsJson = JSON.stringify(records, null, 2);
    if (new TextEncoder().encode(recordsJson).byteLength > maxBackupRecordsBytes) {
      throw new Error("The records and settings exceed the 64 MiB backup metadata limit.");
    }
    archive.file("manifest.json", JSON.stringify(manifest, null, 2));
    archive.file("records.json", recordsJson);
    const backup = await archive.generateAsync({ type: "arraybuffer", compression: "DEFLATE" });
    if (backup.byteLength > maxBackupBytes) {
      throw new Error("The generated backup exceeds the 512 MiB archive limit.");
    }
    return backup;
  }

  private async createBackup(kind: BackupManifest["kind"], moduleId?: string): Promise<ArrayBuffer> {
    const records = await this.database.transaction(
      "r",
      this.database.modules,
      this.database.topics,
      this.database.materials,
      this.database.storedFiles,
      async () => {
        const modules = moduleId
          ? await this.database.modules.get(moduleId).then((item) => item ? [item] : [])
          : await this.database.modules.toArray();
        if (moduleId && modules.length === 0) throw new Error("This module no longer exists.");
        const moduleIds = new Set(modules.map((module) => module.id));
        const topics = moduleId
          ? await this.database.topics.where("moduleId").equals(moduleId).toArray()
          : await this.database.topics.toArray();
        const materials = moduleId
          ? await this.database.materials.where("moduleId").equals(moduleId).toArray()
          : await this.database.materials.toArray();
        const fileBytes = materials.reduce((total, material) => total + material.sizeBytes, 0);
        if (fileBytes > maxBackupBytes) {
          throw new Error("The backup would exceed the 512 MiB export limit.");
        }
        return {
          records: {
            modules: modules.filter((module) => moduleIds.has(module.id)),
            topics: topics.filter((topic) => moduleIds.has(topic.moduleId)),
            materials: materials.filter((material) => !moduleId || material.moduleId === moduleId),
          },
          files: await this.database.storedFiles.bulkGet(materials.map((material) => material.id)),
        };
      },
    );
    const { default: JSZip } = await import("jszip");
    const archive = new JSZip();
    const exported = records.records;
    const storedFiles = records.files;
    let fileBytesTotal = 0;
    for (let index = 0; index < exported.materials.length; index += 1) {
      const material = exported.materials[index];
      const file = storedFiles[index];
      if (!material || !file || file.bytes.byteLength !== material.sizeBytes) {
        throw new Error(`The original file for “${material?.originalFileName ?? "a material"}” is missing or damaged. Nothing was skipped in the backup.`);
      }
      fileBytesTotal += file.bytes.byteLength;
      if (fileBytesTotal > maxBackupBytes) {
        throw new Error("The backup would exceed the 512 MiB export limit.");
      }
      archive.file(`files/${material.id}.bin`, file.bytes.slice(0));
    }
    const manifest = {
      format: backupFormat,
      version: 1,
      kind,
      exportedAt: new Date().toISOString(),
      counts: {
        modules: exported.modules.length,
        topics: exported.topics.length,
        materials: exported.materials.length,
      },
    };
    archive.file("manifest.json", JSON.stringify(manifest, null, 2));
    archive.file("records.json", JSON.stringify(exported, null, 2));
    const backup = await archive.generateAsync({ type: "arraybuffer", compression: "DEFLATE" });
    if (backup.byteLength > maxBackupBytes) {
      throw new Error("The generated backup exceeds the 512 MiB archive limit.");
    }
    return backup;
  }

  async restore(bytes: ArrayBuffer, mode: RestoreMode): Promise<RestoreSummary> {
    const parsed = await parseBackup(bytes);
    if (parsed.kind === "module" && mode === "replace") {
      throw new Error("Module backups cannot replace the complete local library. Choose merge.");
    }
    const { records, files } = parsed;
    let settingsToAdd = records.settings;
    await this.database.transaction(
      "rw",
      [
        this.database.modules,
        this.database.topics,
        this.database.materials,
        this.database.storedFiles,
        this.database.notes,
        this.database.tasks,
        this.database.studySessions,
        this.database.appSettings,
      ],
      async () => {
        if (mode === "replace") {
          await this.database.modules.clear();
          await this.database.topics.clear();
          await this.database.materials.clear();
          await this.database.storedFiles.clear();
          await this.database.notes.clear();
          await this.database.tasks.clear();
          await this.database.studySessions.clear();
          await this.database.appSettings.clear();
        } else {
          const [
            existingModules,
            existingTopics,
            existingMaterials,
            existingFiles,
            existingNotes,
            existingTasks,
            existingSessions,
            existingSettings,
          ] = await Promise.all([
            this.database.modules.toArray(),
            this.database.topics.toArray(),
            this.database.materials.toArray(),
            this.database.storedFiles.toArray(),
            this.database.notes.toArray(),
            this.database.tasks.toArray(),
            this.database.studySessions.toArray(),
            this.database.appSettings.toArray(),
          ]);
          const checkIds = <T extends { id: string }>(incoming: T[], existing: T[], label: string) => {
            const occupied = new Set(existing.map((item) => item.id));
            const collision = incoming.find((item) => occupied.has(item.id));
            if (collision) throw new Error(`Merge stopped: ${label} ID “${collision.id}” already exists. No records were changed.`);
          };
          checkIds(records.modules, existingModules, "module");
          checkIds(records.topics, existingTopics, "topic");
          checkIds(records.materials, existingMaterials, "material");
          checkIds(files, existingFiles, "stored file");
          checkIds(records.notes, existingNotes, "note");
          checkIds(records.tasks, existingTasks, "task");
          checkIds(records.studySessions, existingSessions, "study session");
          settingsToAdd = records.settings.filter((setting) => {
            const existing = existingSettings.find((item) => item.id === setting.id);
            if (existing && existing.theme !== setting.theme) {
              throw new Error("Merge stopped: the appearance setting differs. No records were changed.");
            }
            return !existing;
          });
          const normalizeCode = (code: string) => code.trim().toLocaleLowerCase();
          const existingCodes = new Set(existingModules.map((module) => normalizeCode(module.code)));
          const duplicateCode = records.modules.find((module) => existingCodes.has(normalizeCode(module.code)));
          if (duplicateCode) throw new Error(`Merge stopped: module code “${duplicateCode.code}” already exists. No records were changed.`);
          const allTopics = [...existingTopics, ...records.topics];
          const topicById = new Map(allTopics.map((topic) => [topic.id, topic]));
          const allModules = new Set([...existingModules, ...records.modules].map((module) => module.id));
          for (const material of records.materials) {
            if ((material.moduleId && !allModules.has(material.moduleId)) ||
              (material.topicId && topicById.get(material.topicId)?.moduleId !== material.moduleId)) {
              throw new Error("Merge stopped: a material relationship would be invalid. No records were changed.");
            }
          }
        }
        await this.database.modules.bulkAdd(records.modules);
        await this.database.topics.bulkAdd(records.topics);
        await this.database.materials.bulkAdd(records.materials);
        await this.database.storedFiles.bulkAdd(files);
        await this.database.notes.bulkAdd(records.notes);
        await this.database.tasks.bulkAdd(records.tasks);
        await this.database.studySessions.bulkAdd(records.studySessions);
        await this.database.appSettings.bulkAdd(settingsToAdd);
      },
    );
    return summarize(parsed);
  }

  async inspect(bytes: ArrayBuffer): Promise<{
    kind: "full" | "module";
    summary: RestoreSummary;
    version: number;
    appVersion?: string;
    exportedAt: string;
  }> {
    const parsed = await parseBackup(bytes);
    return {
      kind: parsed.kind,
      summary: summarize(parsed),
      version: parsed.version,
      ...(parsed.appVersion ? { appVersion: parsed.appVersion } : {}),
      exportedAt: parsed.exportedAt,
    };
  }
}

function summarize(parsed: ParsedBackup): RestoreSummary {
  return {
    modules: parsed.records.modules.length,
    topics: parsed.records.topics.length,
    materials: parsed.records.materials.length,
    notes: parsed.records.notes.length,
    tasks: parsed.records.tasks.length,
    studySessions: parsed.records.studySessions.length,
    settings: parsed.records.settings.length,
    files: parsed.files.length,
    bytes: parsed.files.reduce((total, file) => total + file.bytes.byteLength, 0),
    totalBytes: parsed.totalBytes,
  };
}
