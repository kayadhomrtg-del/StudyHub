import { moduleDatabase, type ModuleDatabase } from "../modules/moduleDatabase";
import type { ModuleRecord } from "../modules/module";
import type { TopicRecord } from "../topics/topic";
import type { MaterialRecord } from "../materials/material";
import type { NoteRecord } from "../notes/note";
import type { TaskRecord } from "../tasks/task";
import type { SearchCategory } from "./SearchService";

export interface SearchCorpus {
  modules: ModuleRecord[];
  topics: TopicRecord[];
  materials: MaterialRecord[];
  notes: NoteRecord[];
  tasks: TaskRecord[];
}

export class SearchRepository {
  constructor(private readonly database: ModuleDatabase = moduleDatabase) {}

  async getCorpus(categories: ReadonlySet<SearchCategory>): Promise<SearchCorpus> {
    const [modules, topics, materials, notes, tasks] = await Promise.all([
      categories.has("modules") ? this.database.modules.toArray() : Promise.resolve([] as ModuleRecord[]),
      categories.has("topics") ? this.database.topics.toArray() : Promise.resolve([] as TopicRecord[]),
      categories.has("materials") ? this.database.materials.toArray() : Promise.resolve([] as MaterialRecord[]),
      categories.has("notes") ? this.database.notes.toArray() : Promise.resolve([] as NoteRecord[]),
      categories.has("tasks") ? this.database.tasks.toArray() : Promise.resolve([] as TaskRecord[]),
    ]);
    return { modules, topics, materials, notes, tasks };
  }
}
