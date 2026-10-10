import type { ModuleDatabase } from "./moduleDatabase";
import type { ModuleRecord } from "./module";

export class ModuleRepository {
  constructor(private readonly database: ModuleDatabase) {}

  async getAll(): Promise<ModuleRecord[]> {
    return this.database.modules.orderBy("name").toArray();
  }

  async getById(id: string): Promise<ModuleRecord | undefined> {
    return this.database.modules.get(id);
  }

  async add(module: ModuleRecord): Promise<ModuleRecord> {
    await this.database.modules.add(module);
    return module;
  }

  async update(module: ModuleRecord): Promise<ModuleRecord> {
    const existing = await this.database.modules.get(module.id);
    if (!existing) {
      throw new Error("This module no longer exists. Reload the page and try again.");
    }
    await this.database.modules.put(module);
    return module;
  }

  async delete(id: string): Promise<void> {
    await this.database.transaction(
      "rw",
      [
        this.database.modules,
        this.database.topics,
        this.database.materials,
        this.database.notes,
        this.database.tasks,
        this.database.studySessions,
      ],
      async () => {
        const existing = await this.database.modules.get(id);
        if (!existing) {
          throw new Error("This module no longer exists. Reload the page and try again.");
        }

        const topicIds = new Set(
          await this.database.topics.where("moduleId").equals(id).primaryKeys(),
        );
        await this.database.materials
          .where("moduleId")
          .equals(id)
          .modify((material) => {
            delete material.moduleId;
            if (material.topicId && topicIds.has(material.topicId)) {
              delete material.topicId;
            }
          });
        await this.database.topics.where("moduleId").equals(id).delete();
        await this.database.notes
          .filter((note) =>
            (note.link?.type === "module" && note.link.id === id) ||
            (note.link?.type === "topic" && topicIds.has(note.link.id))
          )
          .modify((note) => {
            delete note.link;
            note.updatedAt = new Date().toISOString();
          });
        await this.database.tasks
          .filter((task) => task.moduleId === id || Boolean(task.topicId && topicIds.has(task.topicId)))
          .modify((task) => {
            delete task.moduleId;
            delete task.topicId;
            task.updatedAt = new Date().toISOString();
          });
        await this.database.studySessions
          .filter((session) => session.moduleId === id || Boolean(session.topicId && topicIds.has(session.topicId)))
          .modify((session) => {
            delete session.moduleId;
            delete session.topicId;
            session.updatedAt = new Date().toISOString();
          });
        await this.database.modules.delete(id);
      },
    );
  }
}
