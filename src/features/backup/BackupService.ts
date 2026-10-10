import type { MaterialRecord, StoredFileRecord } from "../materials/material";
import type { ModuleDatabase } from "../modules/moduleDatabase";
import type { ModuleRecord } from "../modules/module";
import type { TopicRecord } from "../topics/topic";
import { inspectZipArchive } from "../archive/zipSafety";

const backupFormat = "college-study-hub-backup";
const backupVersion = 1;
export const maxBackupBytes = 512 * 1024 * 1024;
const maxBackupRecordsBytes = 16 * 1024 * 1024;
const maxBackupEntries = 10_002;

export interface BackupRecords {
  modules: ModuleRecord[];
  topics: TopicRecord[];
  materials: MaterialRecord[];
}

interface BackupManifest {
  format: typeof backupFormat;
  version: typeof backupVersion;
  kind: "full" | "module";
  exportedAt: string;
  counts: Record<keyof BackupRecords, number>;
}

export type RestoreMode = "merge" | "replace";

export interface RestoreSummary {
  modules: number;
  topics: number;
  materials: number;
  bytes: number;
}

interface ParsedBackup {
  records: BackupRecords;
  files: StoredFileRecord[];
  kind: BackupManifest["kind"];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validTimestamp(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function validateRecords(value: unknown): BackupRecords {
  if (!isObject(value)) throw new Error("The backup records section is missing or invalid.");
  const { modules, topics, materials } = value;
  if (!Array.isArray(modules) || !Array.isArray(topics) || !Array.isArray(materials)) {
    throw new Error("The backup must contain module, topic, and material record arrays.");
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

  const validModules = modules as ModuleRecord[];
  const validTopics = topics as TopicRecord[];
  const validMaterials = materials as MaterialRecord[];
  const moduleIds = new Set(validModules.map((module) => module.id));
  const topicIds = new Set(validTopics.map((topic) => topic.id));
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
      !Number.isInteger(topic.sortOrder) ||
      !validTimestamp(topic.createdAt) ||
      !validTimestamp(topic.updatedAt)
    ) throw new Error("The backup contains a topic with invalid data or a missing module.");
  }
  for (const material of validMaterials) {
    if (
      typeof material.originalFileName !== "string" ||
      !material.originalFileName ||
      typeof material.title !== "string" ||
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
  return { modules: validModules, topics: validTopics, materials: validMaterials };
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
    manifest.version !== backupVersion ||
    !["full", "module"].includes(String(manifest.kind))
  ) throw new Error("This backup format or version is not supported.");

  let recordsValue: unknown;
  try {
    recordsValue = JSON.parse(await recordsFile.async("string")) as unknown;
  } catch {
    throw new Error("The backup records file is not valid JSON.");
  }
  const records = validateRecords(recordsValue);
  if (manifest.kind === "module" && records.modules.length !== 1) {
    throw new Error("A module backup must contain exactly one module record.");
  }
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
  };
  const manifestCounts = manifest.counts;
  if (!isObject(manifestCounts) || Object.entries(expectedCounts).some(([key, count]) => manifestCounts[key] !== count)) {
    throw new Error("The backup manifest record counts do not match the records file.");
  }
  return { records, files, kind: manifest.kind as BackupManifest["kind"] };
}

export class BackupService {
  constructor(private readonly database: ModuleDatabase) {}

  async createFullBackup(): Promise<ArrayBuffer> {
    return this.createBackup("full");
  }

  async createModuleBackup(moduleId: string): Promise<ArrayBuffer> {
    return this.createBackup("module", moduleId);
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
    const manifest: BackupManifest = {
      format: backupFormat,
      version: backupVersion,
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
    const { records, files } = parsed;
    await this.database.transaction(
      "rw",
      this.database.modules,
      this.database.topics,
      this.database.materials,
      this.database.storedFiles,
      async () => {
        if (mode === "replace") {
          await this.database.modules.clear();
          await this.database.topics.clear();
          await this.database.materials.clear();
          await this.database.storedFiles.clear();
        } else {
          const [existingModules, existingTopics, existingMaterials, existingFiles] = await Promise.all([
            this.database.modules.toArray(),
            this.database.topics.toArray(),
            this.database.materials.toArray(),
            this.database.storedFiles.toArray(),
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
      },
    );
    return {
      modules: records.modules.length,
      topics: records.topics.length,
      materials: records.materials.length,
      bytes: files.reduce((total, file) => total + file.bytes.byteLength, 0),
    };
  }

  async inspect(bytes: ArrayBuffer): Promise<{ kind: "full" | "module"; summary: RestoreSummary }> {
    const parsed = await parseBackup(bytes);
    return {
      kind: parsed.kind,
      summary: {
        modules: parsed.records.modules.length,
        topics: parsed.records.topics.length,
        materials: parsed.records.materials.length,
        bytes: parsed.files.reduce((total, file) => total + file.bytes.byteLength, 0),
      },
    };
  }
}
