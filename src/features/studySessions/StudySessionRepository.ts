import type { ModuleDatabase } from "../modules/moduleDatabase";
import type { StudySessionRecord } from "./studySession";

export class StudySessionRepository {
  constructor(private readonly database: ModuleDatabase) {}

  getAll(): Promise<StudySessionRecord[]> {
    return this.database.studySessions.orderBy("plannedStart").toArray();
  }

  getById(id: string): Promise<StudySessionRecord | undefined> {
    return this.database.studySessions.get(id);
  }

  async save(session: StudySessionRecord, isNew: boolean): Promise<StudySessionRecord> {
    return this.database.transaction(
      "rw",
      this.database.studySessions,
      this.database.modules,
      this.database.topics,
      this.database.materials,
      async () => {
        if (!isNew && !(await this.database.studySessions.get(session.id))) {
          throw new Error("This study session no longer exists. Reload the page and try again.");
        }
        if (session.moduleId && !(await this.database.modules.get(session.moduleId))) {
          throw new Error("Choose an existing module for this study session.");
        }
        if (session.topicId) {
          const topic = await this.database.topics.get(session.topicId);
          if (!topic || topic.moduleId !== session.moduleId) {
            throw new Error("Choose a topic that belongs to the selected module.");
          }
        }
        if (session.materialId) {
          const material = await this.database.materials.get(session.materialId);
          if (!material || (material.moduleId && material.moduleId !== session.moduleId)) {
            throw new Error("Choose a material that belongs to the selected module.");
          }
        }
        if (isNew) await this.database.studySessions.add(session);
        else await this.database.studySessions.put(session);
        return session;
      },
    );
  }

  async delete(id: string): Promise<void> {
    await this.database.transaction("rw", this.database.studySessions, async () => {
      if (!(await this.database.studySessions.get(id))) {
        throw new Error("This study session no longer exists. Reload the page and try again.");
      }
      await this.database.studySessions.delete(id);
    });
  }
}
