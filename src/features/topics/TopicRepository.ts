import type { ModuleDatabase } from "../modules/moduleDatabase";
import type { TopicRecord } from "./topic";

export class TopicRepository {
  constructor(private readonly database: ModuleDatabase) {}

  getByModule(moduleId: string): Promise<TopicRecord[]> {
    return this.database.topics
      .where("moduleId")
      .equals(moduleId)
      .sortBy("sortOrder");
  }

  getById(id: string): Promise<TopicRecord | undefined> {
    return this.database.topics.get(id);
  }

  async add(topic: TopicRecord): Promise<TopicRecord> {
    await this.database.transaction(
      "rw",
      this.database.modules,
      this.database.topics,
      async () => {
        if (!(await this.database.modules.get(topic.moduleId))) {
          throw new Error("This module no longer exists. Reload the page and try again.");
        }
        await this.database.topics.add(topic);
      },
    );
    return topic;
  }

  async update(topic: TopicRecord): Promise<TopicRecord> {
    if (!(await this.database.topics.get(topic.id))) {
      throw new Error("This topic no longer exists. Reload the page and try again.");
    }
    await this.database.topics.put(topic);
    return topic;
  }

  async delete(id: string): Promise<void> {
    await this.database.transaction(
      "rw",
      this.database.topics,
      this.database.materials,
      this.database.notes,
      this.database.tasks,
      async () => {
        const topic = await this.database.topics.get(id);
        if (!topic) {
          throw new Error("This topic no longer exists. Reload the page and try again.");
        }
        await this.database.materials.where("topicId").equals(id).modify((material) => {
          delete material.topicId;
          material.updatedAt = new Date().toISOString();
        });
        await this.database.notes
          .filter((note) => note.link?.type === "topic" && note.link.id === id)
          .modify((note) => {
            delete note.link;
            note.updatedAt = new Date().toISOString();
          });
        await this.database.tasks.where("topicId").equals(id).modify((task) => {
          delete task.topicId;
          task.updatedAt = new Date().toISOString();
        });
        await this.database.topics.delete(id);
      },
    );
  }

  reorder(topics: TopicRecord[]): Promise<void> {
    return this.database.transaction("rw", this.database.topics, async () => {
      await this.database.topics.bulkPut(topics);
    });
  }
}
