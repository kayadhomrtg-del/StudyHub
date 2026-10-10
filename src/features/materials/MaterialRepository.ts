import type { ModuleDatabase } from "../modules/moduleDatabase";
import type {
  MaterialAssignment,
  MaterialRecord,
  StoredFileRecord,
} from "./material";

export class MaterialRepository {
  constructor(private readonly database: ModuleDatabase) {}

  getAll(): Promise<MaterialRecord[]> {
    return this.database.materials.orderBy("createdAt").reverse().toArray();
  }

  getById(id: string): Promise<MaterialRecord | undefined> {
    return this.database.materials.get(id);
  }

  getFile(id: string): Promise<StoredFileRecord | undefined> {
    return this.database.storedFiles.get(id);
  }

  async importFile(
    material: MaterialRecord,
    file: StoredFileRecord,
  ): Promise<void> {
    await this.database.transaction(
      "rw",
      this.database.materials,
      this.database.storedFiles,
      this.database.modules,
      this.database.topics,
      async () => {
        if (material.moduleId) {
          if (!(await this.database.modules.get(material.moduleId))) {
            throw new Error("The selected module could not be found.");
          }
          if (material.topicId) {
            const topic = await this.database.topics.get(material.topicId);
            if (!topic || topic.moduleId !== material.moduleId) {
              throw new Error("Choose a topic that belongs to the selected module.");
            }
          }
        } else if (material.topicId) {
          throw new Error("Choose a module before assigning a topic.");
        }
        await this.database.storedFiles.add(file);
        await this.database.materials.add(material);
      },
    );
  }

  async update(material: MaterialRecord): Promise<MaterialRecord> {
    if (!(await this.database.materials.get(material.id))) {
      throw new Error("This material no longer exists. Reload the page and try again.");
    }
    await this.database.materials.put(material);
    return material;
  }

  async updateAssignment(
    id: string,
    assignment: MaterialAssignment,
  ): Promise<MaterialRecord> {
    const material = await this.database.materials.get(id);
    if (!material) {
      throw new Error("This material no longer exists. Reload the page and try again.");
    }
    return this.updateDetails(id, assignment, material.tags);
  }

  async updateDetails(
    id: string,
    assignment: MaterialAssignment,
    tags: string[],
  ): Promise<MaterialRecord> {
    return this.database.transaction(
      "rw",
      this.database.materials,
      this.database.topics,
      this.database.modules,
      async () => {
        const material = await this.database.materials.get(id);
        if (!material) {
          throw new Error("This material no longer exists. Reload the page and try again.");
        }
        if (assignment.moduleId) {
          if (!(await this.database.modules.get(assignment.moduleId))) {
            throw new Error("The selected module could not be found.");
          }
          if (assignment.topicId) {
            const topic = await this.database.topics.get(assignment.topicId);
            if (!topic || topic.moduleId !== assignment.moduleId) {
              throw new Error("Choose a topic that belongs to the selected module.");
            }
          }
        } else if (assignment.topicId) {
          throw new Error("Choose a module before assigning a topic.");
        }

        const updated: MaterialRecord = {
          ...material,
          ...(assignment.moduleId ? { moduleId: assignment.moduleId } : {}),
          ...(assignment.topicId ? { topicId: assignment.topicId } : {}),
          tags,
          updatedAt: new Date().toISOString(),
        };
        if (!assignment.moduleId) delete updated.moduleId;
        if (!assignment.topicId) delete updated.topicId;
        await this.database.materials.put(updated);
        return updated;
      },
    );
  }

  delete(id: string): Promise<void> {
    return this.database.transaction(
      "rw",
      this.database.materials,
      this.database.storedFiles,
      async () => {
        if (!(await this.database.materials.get(id))) {
          throw new Error("This material no longer exists. Reload the page and try again.");
        }
        await this.database.materials.delete(id);
        await this.database.storedFiles.delete(id);
      },
    );
  }
}
