export type NoteLink =
  | { type: "module"; id: string; label?: string }
  | { type: "topic"; id: string; label?: string }
  | { type: "material"; id: string; label?: string }
  | { type: "task"; id: string; label?: string };

export interface NoteDraft {
  title: string;
  markdown: string;
  tags: string[];
  isPinned: boolean;
  link?: NoteLink;
}

export interface NoteRecord extends NoteDraft {
  id: string;
  createdAt: string;
  updatedAt: string;
}
