import { moduleDatabase } from "../modules/moduleDatabase";
import { NoteRepository } from "./NoteRepository";
import type { NoteDraft, NoteLink, NoteRecord } from "./note";

const maxTitleLength = 200;
const maxMarkdownCharacters = 1_000_000;
const maxTags = 30;
const maxTagLength = 50;

function normalizeDraft(draft: NoteDraft): NoteDraft {
  const title = draft.title.trim();
  if (title.length > maxTitleLength) throw new Error(`Note titles must be ${maxTitleLength} characters or fewer.`);
  if (draft.markdown.length > maxMarkdownCharacters) {
    throw new Error("Note content exceeds the 1,000,000 character limit.");
  }
  if (draft.tags.length > maxTags) throw new Error(`Notes can have up to ${maxTags} tags.`);
  const tags = [...new Set(draft.tags.map((tag) => tag.trim()).filter(Boolean))];
  if (tags.some((tag) => tag.length > maxTagLength)) {
    throw new Error(`Note tags must be ${maxTagLength} characters or fewer.`);
  }
  const link = draft.link ? normalizeLink(draft.link) : undefined;
  return {
    title,
    markdown: draft.markdown,
    tags,
    isPinned: draft.isPinned,
    ...(link ? { link } : {}),
  };
}

function normalizeLink(link: NoteLink): NoteLink {
  if (!link.id.trim() || link.id.length > 128) throw new Error("Choose a valid note link.");
  const label = link.label?.trim();
  if (label && label.length > 200) throw new Error("Link labels must be 200 characters or fewer.");
  return {
    type: link.type,
    id: link.id.trim(),
    ...(label ? { label } : {}),
  };
}

export class NoteService {
  private readonly pendingSaves = new Map<string, Promise<NoteRecord>>();

  constructor(
    private readonly repository: NoteRepository,
    private readonly createId: () => string = () => crypto.randomUUID(),
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  getAll(): Promise<NoteRecord[]> {
    return this.repository.getAll();
  }

  getById(id: string): Promise<NoteRecord | undefined> {
    return this.repository.getById(id);
  }

  async create(): Promise<NoteRecord> {
    const timestamp = this.now();
    return this.repository.add({
      id: this.createId(),
      title: "",
      markdown: "",
      tags: [],
      isPinned: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  async saveDraft(id: string, input: NoteDraft): Promise<NoteRecord> {
    const draft = normalizeDraft(input);
    const previous = this.pendingSaves.get(id);
    const pending = previous
      ? previous.catch(() => undefined).then(() => this.repository.saveDraft(id, draft, this.now()))
      : this.repository.saveDraft(id, draft, this.now());
    this.pendingSaves.set(id, pending);
    void pending.finally(() => {
      if (this.pendingSaves.get(id) === pending) this.pendingSaves.delete(id);
    }).catch(() => undefined);
    return pending;
  }

  async setPinned(id: string, isPinned: boolean): Promise<NoteRecord> {
    await this.pendingSaves.get(id);
    const note = await this.repository.getById(id);
    if (!note) throw new Error("This note no longer exists. Reload the page and try again.");
    return this.saveDraft(id, { ...note, isPinned });
  }

  async delete(id: string): Promise<void> {
    await this.pendingSaves.get(id)?.catch(() => undefined);
    await this.repository.delete(id);
  }

  async search(query: string): Promise<NoteRecord[]> {
    const notes = await this.getAll();
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return notes;
    return notes.filter((note) =>
      [note.title, note.markdown, ...note.tags, note.link?.label ?? ""]
        .some((value) => value.toLocaleLowerCase().includes(needle)),
    );
  }
}

export const noteService = new NoteService(new NoteRepository(moduleDatabase));
