import { moduleDatabase } from "../modules/moduleDatabase";
import type {
  MaterialAssignment,
  MaterialImportResult,
  MaterialRecord,
} from "./material";
import { getDisplayTitle, getExtension } from "./material";
import { MaterialRepository } from "./MaterialRepository";
import { studyStatuses, type StudyStatus } from "../studyStatus";

export class MaterialService {
  constructor(
    private readonly repository: MaterialRepository,
    private readonly createId: () => string = () => crypto.randomUUID(),
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  getAll(): Promise<MaterialRecord[]> {
    return this.repository.getAll();
  }

  getById(id: string): Promise<MaterialRecord | undefined> {
    return this.repository.getById(id);
  }

  getFile(id: string) {
    return this.repository.getFile(id);
  }

  async importFiles(
    files: File[],
    options: { assignment?: MaterialAssignment; tags?: string[] } = {},
  ): Promise<MaterialImportResult[]> {
    const tags = normalizeTags(options.tags ?? []);
    const results: MaterialImportResult[] = [];

    for (const file of files) {
      try {
        const id = this.createId();
        const timestamp = this.now();
        const assignment = options.assignment ?? {};
        const material: MaterialRecord = {
          id,
          title: getDisplayTitle(file.name),
          originalFileName: file.name,
          mimeType: file.type || "application/octet-stream",
          ...(getExtension(file.name) ? { extension: getExtension(file.name) } : {}),
          sizeBytes: file.size,
          ...(assignment.moduleId ? { moduleId: assignment.moduleId } : {}),
          ...(assignment.topicId ? { topicId: assignment.topicId } : {}),
          tags,
          status: "not-started",
          isFavorite: false,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        const bytes = await readFileBytes(file);
        await this.repository.importFile(material, { id, bytes });
        results.push({ fileName: file.name, status: "success", material });
      } catch (error) {
        results.push({
          fileName: file.name,
          status: "failure",
          message: isQuotaExceeded(error)
            ? "Not enough browser storage is available. This file was not saved; free space and try again."
            : error instanceof Error
              ? error.message
              : "This file could not be saved. Please try again.",
        });
      }
    }

    return results;
  }

  async updateAssignment(
    id: string,
    assignment: MaterialAssignment,
  ): Promise<MaterialRecord> {
    return this.repository.updateAssignment(id, assignment);
  }

  updateDetails(
    id: string,
    assignment: MaterialAssignment,
    tags: string[],
  ): Promise<MaterialRecord> {
    return this.repository.updateDetails(id, assignment, normalizeTags(tags));
  }

  async setFavorite(id: string, isFavorite: boolean): Promise<MaterialRecord> {
    const material = await this.repository.getById(id);
    if (!material) {
      throw new Error("This material no longer exists. Reload the page and try again.");
    }
    return this.repository.update({
      ...material,
      isFavorite,
      updatedAt: this.now(),
    });
  }

  async setStatus(id: string, status: StudyStatus): Promise<MaterialRecord> {
    if (!studyStatuses.includes(status)) {
      throw new Error("Choose a valid study status.");
    }
    const material = await this.repository.getById(id);
    if (!material) {
      throw new Error("This material no longer exists. Reload the page and try again.");
    }
    return this.repository.update({
      ...material,
      status,
      updatedAt: this.now(),
    });
  }

  async setTags(id: string, tags: string[]): Promise<MaterialRecord> {
    const material = await this.repository.getById(id);
    if (!material) {
      throw new Error("This material no longer exists. Reload the page and try again.");
    }
    return this.repository.update({
      ...material,
      tags: normalizeTags(tags),
      updatedAt: this.now(),
    });
  }

  delete(id: string): Promise<void> {
    return this.repository.delete(id);
  }
}

export function normalizeTags(tags: string[]): string[] {
  return [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))];
}

function readFileBytes(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("The file could not be read."));
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result);
      } else {
        reject(new Error("The selected file could not be read as bytes."));
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

function isQuotaExceeded(error: unknown): boolean {
  let current: unknown = error;
  const visited = new Set<unknown>();
  while (current && !visited.has(current)) {
    visited.add(current);
    if (
      current instanceof DOMException &&
      (current.name === "QuotaExceededError" || current.code === 22)
    ) {
      return true;
    }
    if (
      typeof current === "object" &&
      "name" in current &&
      (current.name === "QuotaExceededError" || current.name === "NS_ERROR_DOM_QUOTA_REACHED")
    ) {
      return true;
    }
    current =
      typeof current === "object" && current !== null && "cause" in current
        ? current.cause
        : undefined;
  }
  return false;
}

export const materialService = new MaterialService(
  new MaterialRepository(moduleDatabase),
);
