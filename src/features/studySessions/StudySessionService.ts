import { moduleDatabase } from "../modules/moduleDatabase";
import { localDateTimeToIso, toLocalDateTimeInput } from "./localDateTime";
import { StudySessionRepository } from "./StudySessionRepository";
import type { StudySessionInput, StudySessionRecord, StudySessionStatus } from "./studySession";

const maxTitleLength = 200;
const maxGoalLength = 2000;

function normalize(
  input: StudySessionInput,
  allowUnlinkedModule = false,
): Omit<StudySessionRecord, "id" | "createdAt" | "updatedAt"> {
  const title = input.title.trim();
  if (!title) throw new Error("Enter a study session title.");
  if (title.length > maxTitleLength) throw new Error(`Session titles must be ${maxTitleLength} characters or fewer.`);
  if (!input.moduleId.trim() && !allowUnlinkedModule) {
    throw new Error("Choose a module for this study session.");
  }
  if (!Number.isInteger(input.plannedDurationMinutes) || input.plannedDurationMinutes < 1) {
    throw new Error("Planned duration must be at least one minute.");
  }
  if (input.actualDurationMinutes !== null &&
    (!Number.isInteger(input.actualDurationMinutes) || input.actualDurationMinutes < 0)) {
    throw new Error("Actual duration must be zero or more whole minutes.");
  }
  const goal = input.goal.trim();
  if (goal.length > maxGoalLength) throw new Error(`Session goals must be ${maxGoalLength} characters or fewer.`);
  if (!["planned", "completed", "skipped"].includes(input.status)) {
    throw new Error("Choose a valid study session status.");
  }
  return {
    ...(input.moduleId.trim() ? { moduleId: input.moduleId.trim() } : {}),
    ...(input.topicId.trim() ? { topicId: input.topicId.trim() } : {}),
    ...(input.materialId.trim() ? { materialId: input.materialId.trim() } : {}),
    title,
    plannedStart: localDateTimeToIso(input.plannedStart),
    plannedDurationMinutes: input.plannedDurationMinutes,
    ...(goal ? { goal } : {}),
    status: input.status,
    actualDurationMinutes: input.actualDurationMinutes,
  };
}

export class StudySessionService {
  constructor(
    private readonly repository: StudySessionRepository,
    private readonly createId: () => string = () => crypto.randomUUID(),
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  getAll(): Promise<StudySessionRecord[]> {
    return this.repository.getAll();
  }

  getById(id: string): Promise<StudySessionRecord | undefined> {
    return this.repository.getById(id);
  }

  async create(input: StudySessionInput): Promise<StudySessionRecord> {
    const timestamp = this.now();
    return this.repository.save({
      ...normalize(input),
      id: this.createId(),
      createdAt: timestamp,
      updatedAt: timestamp,
    }, true);
  }

  async update(id: string, input: StudySessionInput): Promise<StudySessionRecord> {
    const existing = await this.repository.getById(id);
    if (!existing) throw new Error("This study session no longer exists. Reload the page and try again.");
    return this.repository.save({
      ...existing,
      ...normalize(input, existing.moduleId === undefined),
      id,
      createdAt: existing.createdAt,
      updatedAt: this.now(),
    }, false);
  }

  async setStatus(id: string, status: StudySessionStatus, actualDurationMinutes?: number | null): Promise<StudySessionRecord> {
    const existing = await this.repository.getById(id);
    if (!existing) throw new Error("This study session no longer exists. Reload the page and try again.");
    return this.update(id, {
      moduleId: existing.moduleId ?? "",
      topicId: existing.topicId ?? "",
      materialId: existing.materialId ?? "",
      title: existing.title,
      plannedStart: toLocalDateTimeInput(existing.plannedStart),
      plannedDurationMinutes: existing.plannedDurationMinutes,
      goal: existing.goal ?? "",
      status,
      actualDurationMinutes: actualDurationMinutes === undefined
        ? existing.actualDurationMinutes
        : actualDurationMinutes,
    });
  }

  delete(id: string): Promise<void> {
    return this.repository.delete(id);
  }
}

export const studySessionService = new StudySessionService(
  new StudySessionRepository(moduleDatabase),
);
