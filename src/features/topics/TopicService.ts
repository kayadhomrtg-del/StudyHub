import { TopicRepository } from "./TopicRepository";
import { moduleDatabase } from "../modules/moduleDatabase";
import type { TopicInput, TopicRecord } from "./topic";

export class TopicService {
  constructor(
    private readonly repository: TopicRepository,
    private readonly createId: () => string = () => crypto.randomUUID(),
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  getByModule(moduleId: string): Promise<TopicRecord[]> {
    return this.repository.getByModule(moduleId);
  }

  async create(moduleId: string, input: TopicInput): Promise<TopicRecord> {
    const title = input.title.trim();
    if (!title) throw new Error("Enter a topic name.");
    if (title.length > 100) throw new Error("Topic names must be 100 characters or fewer.");
    const description = input.description?.trim() ?? "";
    if (description.length > 1000) throw new Error("Topic descriptions must be 1,000 characters or fewer.");

    const topics = await this.repository.getByModule(moduleId);
    const timestamp = this.now();
    return this.repository.add({
      id: this.createId(),
      moduleId,
      title,
      ...(description ? { description } : {}),
      sortOrder: topics.length,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  async rename(id: string, input: TopicInput): Promise<TopicRecord> {
    const topic = await this.repository.getById(id);
    if (!topic) {
      throw new Error("This topic no longer exists. Reload the page and try again.");
    }

    const title = input.title.trim();
    if (!title) throw new Error("Enter a topic name.");
    if (title.length > 100) throw new Error("Topic names must be 100 characters or fewer.");
    const description = input.description?.trim() ?? topic.description ?? "";
    if (description.length > 1000) throw new Error("Topic descriptions must be 1,000 characters or fewer.");

    return this.repository.update({
      ...topic,
      title,
      ...(description ? { description } : {}),
      updatedAt: this.now(),
    });
  }

  async move(id: string, direction: -1 | 1): Promise<void> {
    const topic = await this.repository.getById(id);
    if (!topic) {
      throw new Error("This topic no longer exists. Reload the page and try again.");
    }
    const topics = await this.repository.getByModule(topic.moduleId);
    const index = topics.findIndex((item) => item.id === id);
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= topics.length) return;

    const reordered = [...topics];
    [reordered[index], reordered[targetIndex]] = [
      reordered[targetIndex],
      reordered[index],
    ];
    const timestamp = this.now();
    await this.repository.reorder(
      reordered.map((item, sortOrder) => ({ ...item, sortOrder, updatedAt: timestamp })),
    );
  }

  delete(id: string): Promise<void> {
    return this.repository.delete(id);
  }
}

export const topicService = new TopicService(new TopicRepository(moduleDatabase));
