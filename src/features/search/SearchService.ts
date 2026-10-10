import { SearchRepository } from "./SearchRepository";

export type SearchCategory = "modules" | "topics" | "materials" | "notes" | "tasks";

export interface SearchResult<T = unknown> {
  category: SearchCategory;
  id: string;
  title: string;
  description: string;
  href: string;
  record: T;
}

export type SearchResults = Record<SearchCategory, SearchResult[]>;

export const emptySearchResults = (): SearchResults => ({
  modules: [],
  topics: [],
  materials: [],
  notes: [],
  tasks: [],
});

export class SearchService {
  constructor(private readonly repository = new SearchRepository()) {}

  async search(query: string, category: SearchCategory | "all" = "all"): Promise<SearchResults> {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return emptySearchResults();

    const wanted = new Set<SearchCategory>(
      category === "all" ? ["modules", "topics", "materials", "notes", "tasks"] : [category],
    );
    const { modules, topics, materials, notes, tasks } = await this.repository.getCorpus(wanted);
    const results = emptySearchResults();
    const moduleNames = new Map(modules.map((module) => [module.id, module.name]));

    results.modules = modules
      .filter((module) => [module.name, module.code].some((value) => value.toLocaleLowerCase().includes(needle)))
      .map((record) => ({
        category: "modules",
        id: record.id,
        title: record.name,
        description: record.code,
        href: `/modules/${record.id}`,
        record,
      }));
    results.topics = topics
      .filter((topic) => [topic.title, topic.description ?? ""]
        .some((value) => value.toLocaleLowerCase().includes(needle)))
      .map((record) => ({
        category: "topics",
        id: record.id,
        title: record.title,
        description: moduleNames.get(record.moduleId) ?? "Module unavailable",
        href: `/modules/${record.moduleId}`,
        record,
      }));
    results.materials = materials
      .filter((material) => [material.title, material.originalFileName, ...material.tags]
        .some((value) => value.toLocaleLowerCase().includes(needle)))
      .map((record) => ({
        category: "materials",
        id: record.id,
        title: record.title,
        description: record.originalFileName,
        href: `/materials/${record.id}`,
        record,
      }));
    results.notes = notes
      .filter((note) => [note.title, note.markdown, ...note.tags]
        .some((value) => value.toLocaleLowerCase().includes(needle)))
      .map((record) => ({
        category: "notes",
        id: record.id,
        title: record.title || "Untitled note",
        description: record.markdown.replace(/[#*`>\n]/g, " ").trim().slice(0, 180),
        href: `/notes/${record.id}`,
        record,
      }));
    results.tasks = tasks
      .filter((task) => [task.title, task.description].some((value) => value.toLocaleLowerCase().includes(needle)))
      .map((record) => ({
        category: "tasks",
        id: record.id,
        title: record.title,
        description: record.description || `${record.status.replace("-", " ")} · ${record.type}`,
        href: `/tasks?taskId=${encodeURIComponent(record.id)}`,
        record,
      }));
    return results;
  }
}

export const searchService = new SearchService();
