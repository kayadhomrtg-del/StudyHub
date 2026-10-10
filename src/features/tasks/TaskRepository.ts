import type { ModuleDatabase } from "../modules/moduleDatabase";
import type { TaskInput, TaskPriority, TaskRecord, TaskStatus } from "./task";

export class TaskRepository {
  constructor(private readonly database: ModuleDatabase) {}

  getAll(): Promise<TaskRecord[]> {
    return this.database.tasks.orderBy("updatedAt").reverse().toArray();
  }

  getById(id: string): Promise<TaskRecord | undefined> {
    return this.database.tasks.get(id);
  }

  async add(task: TaskRecord): Promise<TaskRecord> {
    await this.database.transaction(
      "rw",
      this.database.tasks,
      this.database.modules,
      this.database.topics,
      this.database.materials,
      async () => {
        await this.validateLinks(task);
        await this.database.tasks.add(task);
      },
    );
    return task;
  }

  async update(task: TaskRecord): Promise<TaskRecord> {
    return this.database.transaction(
      "rw",
      this.database.tasks,
      this.database.modules,
      this.database.topics,
      this.database.materials,
      async () => {
        if (!(await this.database.tasks.get(task.id))) {
          throw new Error("This task no longer exists. Reload the page and try again.");
        }
        await this.validateLinks(task);
        await this.database.tasks.put(task);
        return task;
      },
    );
  }

  async setStatus(id: string, status: TaskStatus, updatedAt: string): Promise<TaskRecord> {
    return this.database.transaction("rw", this.database.tasks, async () => {
      const task = await this.database.tasks.get(id);
      if (!task) throw new Error("This task no longer exists. Reload the page and try again.");
      const updated: TaskRecord = { ...task, status, updatedAt };
      if (status === "completed") updated.completedAt ??= updatedAt;
      else delete updated.completedAt;
      await this.database.tasks.put(updated);
      return updated;
    });
  }

  async setPriority(id: string, priority: TaskPriority, updatedAt: string): Promise<TaskRecord> {
    return this.database.transaction("rw", this.database.tasks, async () => {
      const task = await this.database.tasks.get(id);
      if (!task) throw new Error("This task no longer exists. Reload the page and try again.");
      const updated = { ...task, priority, updatedAt };
      await this.database.tasks.put(updated);
      return updated;
    });
  }

  async delete(id: string): Promise<void> {
    await this.database.transaction(
      "rw",
      this.database.tasks,
      this.database.notes,
      async () => {
        if (!(await this.database.tasks.get(id))) {
          throw new Error("This task no longer exists. Reload the page and try again.");
        }
        await this.database.notes
          .filter((note) => note.link?.type === "task" && note.link.id === id)
          .modify((note) => {
            delete note.link;
            note.updatedAt = new Date().toISOString();
          });
        await this.database.tasks.delete(id);
      },
    );
  }

  async saveInput(
    input: TaskInput,
    existing: TaskRecord | undefined,
    id: string,
    timestamp: string,
  ): Promise<TaskRecord> {
    const record: TaskRecord = {
      ...(existing ?? {}),
      ...input,
      id,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
      ...(input.moduleId ? { moduleId: input.moduleId } : {}),
      ...(input.topicId ? { topicId: input.topicId } : {}),
      ...(input.dueAt ? { dueAt: input.dueAt } : {}),
      ...(input.status === "completed"
        ? { completedAt: existing?.completedAt ?? timestamp }
        : {}),
    };
    if (!input.moduleId) delete record.moduleId;
    if (!input.topicId) delete record.topicId;
    if (!input.dueAt) delete record.dueAt;
    if (input.status !== "completed") delete record.completedAt;
    return existing ? this.update(record) : this.add(record);
  }

  private async validateLinks(task: TaskRecord): Promise<void> {
    if (task.moduleId && !(await this.database.modules.get(task.moduleId))) {
      throw new Error("The selected module could not be found.");
    }
    if (task.topicId) {
      const topic = await this.database.topics.get(task.topicId);
      if (!topic || !task.moduleId || topic.moduleId !== task.moduleId) {
        throw new Error("Choose a topic that belongs to the selected module.");
      }
    }
    for (const materialId of task.linkedMaterialIds) {
      if (!(await this.database.materials.get(materialId))) {
        throw new Error("A linked material could not be found.");
      }
    }
  }
}
