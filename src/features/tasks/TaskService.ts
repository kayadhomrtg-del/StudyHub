import { moduleDatabase } from "../modules/moduleDatabase";
import { TaskRepository } from "./TaskRepository";
import { taskPriorities, taskStatuses, taskTypes, type TaskInput, type TaskPriority, type TaskRecord, type TaskStatus, type TaskType } from "./task";

const maxTitleLength = 200;
const maxDescriptionLength = 10_000;
const maxTags = 30;
const maxTagLength = 50;
const dateTimePattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2})$/;

function isValidDateTime(value: string): boolean {
  const match = dateTimePattern.exec(value);
  if (!match || !Number.isFinite(Date.parse(value))) return false;
  const [, year, month, day, hour, minute, second = "0"] = match;
  const calendar = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second)));
  return calendar.getUTCFullYear() === Number(year) &&
    calendar.getUTCMonth() === Number(month) - 1 &&
    calendar.getUTCDate() === Number(day) &&
    Number(hour) < 24 &&
    Number(minute) < 60 &&
    Number(second) < 60;
}

function normalizeInput(input: TaskInput): TaskInput {
  const title = input.title.trim();
  if (!title) throw new Error("Enter a task title.");
  if (title.length > maxTitleLength) throw new Error(`Task titles must be ${maxTitleLength} characters or fewer.`);
  const description = input.description.trim();
  if (description.length > maxDescriptionLength) throw new Error(`Task descriptions must be ${maxDescriptionLength} characters or fewer.`);
  if (input.dueAt && !isValidDateTime(input.dueAt)) {
    throw new Error("Enter a valid due date and time.");
  }
  if (!taskPriorities.includes(input.priority)) throw new Error("Choose a valid task priority.");
  if (!taskStatuses.includes(input.status)) throw new Error("Choose a valid task status.");
  if (!taskTypes.includes(input.type)) throw new Error("Choose a valid task type.");
  if (input.tags.length > maxTags) throw new Error(`Tasks can have up to ${maxTags} tags.`);
  const tags = [...new Set(input.tags.map((tag) => tag.trim()).filter(Boolean))];
  if (tags.some((tag) => tag.length > maxTagLength)) throw new Error(`Task tags must be ${maxTagLength} characters or fewer.`);
  return {
    ...input,
    title,
    description,
    moduleId: input.moduleId.trim(),
    topicId: input.topicId.trim(),
    dueAt: input.dueAt.trim(),
    linkedMaterialIds: [...new Set(input.linkedMaterialIds)],
    tags,
  };
}

export const emptyTaskInput = (): TaskInput => ({
  title: "",
  description: "",
  moduleId: "",
  topicId: "",
  dueAt: "",
  priority: "medium",
  status: "not-started",
  type: "assignment",
  linkedMaterialIds: [],
  tags: [],
});

export class TaskService {
  constructor(
    private readonly repository: TaskRepository,
    private readonly createId: () => string = () => crypto.randomUUID(),
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  getAll(): Promise<TaskRecord[]> {
    return this.repository.getAll();
  }

  async getUpcoming(limit = 5, now = Date.now()): Promise<TaskRecord[]> {
    return (await this.getAll())
      .filter((task) =>
        task.dueAt &&
        Date.parse(task.dueAt) >= now &&
        task.status !== "completed" &&
        task.status !== "submitted",
      )
      .sort((left, right) => Date.parse(left.dueAt!) - Date.parse(right.dueAt!))
      .slice(0, limit);
  }

  async create(input: TaskInput): Promise<TaskRecord> {
    return this.repository.saveInput(normalizeInput(input), undefined, this.createId(), this.now());
  }

  async update(id: string, input: TaskInput): Promise<TaskRecord> {
    const existing = await this.repository.getById(id);
    if (!existing) throw new Error("This task no longer exists. Reload the page and try again.");
    return this.repository.saveInput(normalizeInput(input), existing, id, this.now());
  }

  async setStatus(id: string, status: TaskStatus): Promise<TaskRecord> {
    if (!taskStatuses.includes(status)) throw new Error("Choose a valid task status.");
    return this.repository.setStatus(id, status, this.now());
  }

  async setPriority(id: string, priority: TaskPriority): Promise<TaskRecord> {
    if (!taskPriorities.includes(priority)) throw new Error("Choose a valid task priority.");
    return this.repository.setPriority(id, priority, this.now());
  }

  delete(id: string): Promise<void> {
    return this.repository.delete(id);
  }
}

export { taskPriorities, taskStatuses, taskTypes, type TaskInput, type TaskPriority, type TaskStatus, type TaskType };
export const taskService = new TaskService(new TaskRepository(moduleDatabase));
