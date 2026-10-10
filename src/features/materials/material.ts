import type { StudyStatus } from "../studyStatus";

export interface MaterialRecord {
  id: string;
  title: string;
  originalFileName: string;
  mimeType: string;
  extension?: string;
  sizeBytes: number;
  moduleId?: string;
  topicId?: string;
  tags: string[];
  status: StudyStatus;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt?: string;
}

export interface StoredFileRecord {
  id: string;
  bytes: ArrayBuffer;
}

export type MaterialAssignment = Pick<MaterialRecord, "moduleId" | "topicId">;

export type MaterialImportResult =
  | { fileName: string; status: "success"; material: MaterialRecord }
  | { fileName: string; status: "failure"; message: string };

export function getExtension(fileName: string): string | undefined {
  const dot = fileName.lastIndexOf(".");
  if (dot <= 0 || dot === fileName.length - 1) return undefined;
  return fileName.slice(dot + 1).toLocaleLowerCase();
}

export function getDisplayTitle(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot > 0 ? fileName.slice(0, dot) : fileName;
}
