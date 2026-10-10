import type {
  ModuleInput,
  ModuleRecord,
  ModuleValidationErrors,
} from "./module";
import { validateModuleInput } from "./module";
import { ModuleRepository } from "./ModuleRepository";
import { moduleDatabase } from "./moduleDatabase";

export class ModuleValidationError extends Error {
  constructor(readonly fieldErrors: ModuleValidationErrors) {
    super("Check the highlighted fields and try again.");
    this.name = "ModuleValidationError";
  }
}

export class ModuleService {
  constructor(
    private readonly repository: ModuleRepository,
    private readonly createId: () => string = () => crypto.randomUUID(),
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  getAll(): Promise<ModuleRecord[]> {
    return this.repository.getAll();
  }

  async getById(id: string): Promise<ModuleRecord | undefined> {
    return this.repository.getById(id);
  }

  async create(input: ModuleInput): Promise<ModuleRecord> {
    const existingModules = await this.repository.getAll();
    const { errors, normalized } = validateModuleInput(input, existingModules);
    if (Object.keys(errors).length > 0) {
      throw new ModuleValidationError(errors);
    }

    const timestamp = this.now();
    const module: ModuleRecord = {
      id: this.createId(),
      ...this.persistableFields(normalized),
      isArchived: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    return this.repository.add(module);
  }

  async update(id: string, input: ModuleInput): Promise<ModuleRecord> {
    const existing = await this.repository.getById(id);
    if (!existing) {
      throw new Error("This module no longer exists. Reload the page and try again.");
    }

    const allModules = await this.repository.getAll();
    const { errors, normalized } = validateModuleInput(input, allModules, id);
    if (Object.keys(errors).length > 0) {
      throw new ModuleValidationError(errors);
    }

    return this.repository.update({
      id: existing.id,
      ...this.persistableFields(normalized),
      isArchived: existing.isArchived,
      createdAt: existing.createdAt,
      updatedAt: this.now(),
    });
  }

  async setArchived(id: string, isArchived: boolean): Promise<ModuleRecord> {
    const existing = await this.repository.getById(id);
    if (!existing) {
      throw new Error("This module no longer exists. Reload the page and try again.");
    }

    return this.repository.update({
      ...existing,
      isArchived,
      updatedAt: this.now(),
    });
  }

  delete(id: string): Promise<void> {
    return this.repository.delete(id);
  }

  private persistableFields(input: ModuleInput): Omit<
    ModuleRecord,
    "id" | "isArchived" | "createdAt" | "updatedAt"
  > {
    return {
      name: input.name,
      code: input.code,
      ...(input.semester ? { semester: input.semester } : {}),
      ...(input.academicYear ? { academicYear: input.academicYear } : {}),
      ...(input.lecturer ? { lecturer: input.lecturer } : {}),
      ...(input.description ? { description: input.description } : {}),
      ...(input.color ? { color: input.color } : {}),
    };
  }
}

export const moduleService = new ModuleService(
  new ModuleRepository(moduleDatabase),
);
