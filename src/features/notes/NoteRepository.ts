import type { ModuleDatabase } from "../modules/moduleDatabase";
import type { NoteDraft, NoteLink, NoteRecord } from "./note";

export class NoteRepository {
  constructor(private readonly database: ModuleDatabase) {}

  getAll(): Promise<NoteRecord[]> {
    return this.database.notes.orderBy("updatedAt").reverse().toArray();
  }

  getById(id: string): Promise<NoteRecord | undefined> {
    return this.database.notes.get(id);
  }

  async add(note: NoteRecord): Promise<NoteRecord> {
    await this.database.notes.add(note);
    return note;
  }

  async addDraft(note: NoteRecord): Promise<NoteRecord> {
    return this.database.transaction(
      "rw",
      this.database.notes,
      this.database.modules,
      this.database.topics,
      this.database.materials,
      this.database.tasks,
      async () => {
        if (note.link) await this.ensureLinkExists(note.link);
        await this.database.notes.add(note);
        return note;
      },
    );
  }

  async saveDraft(id: string, draft: NoteDraft, updatedAt: string): Promise<NoteRecord> {
    return this.database.transaction(
      "rw",
      this.database.notes,
      this.database.modules,
      this.database.topics,
      this.database.materials,
      this.database.tasks,
      async () => {
        const existing = await this.database.notes.get(id);
        if (!existing) throw new Error("This note no longer exists. Reload the page and try again.");
        if (draft.link) await this.ensureLinkExists(draft.link);
        const saved: NoteRecord = {
          ...existing,
          ...draft,
          ...(draft.link ? { link: { ...draft.link } } : {}),
          updatedAt,
        };
        if (!draft.link) delete saved.link;
        await this.database.notes.put(saved);
        return saved;
      },
    );
  }

  private async ensureLinkExists(link: NoteLink): Promise<void> {
    const exists =
      link.type === "module"
        ? await this.database.modules.get(link.id)
        : link.type === "topic"
          ? await this.database.topics.get(link.id)
          : link.type === "material"
            ? await this.database.materials.get(link.id)
            : await this.database.tasks.get(link.id);
    if (!exists) throw new Error(`The linked ${link.type} no longer exists.`);
  }

  delete(id: string): Promise<void> {
    return this.database.notes.delete(id);
  }
}
