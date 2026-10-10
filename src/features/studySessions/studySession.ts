export type StudySessionStatus = "planned" | "completed" | "skipped";

export interface StudySessionInput {
  moduleId: string;
  topicId: string;
  materialId: string;
  title: string;
  plannedStart: string;
  plannedDurationMinutes: number;
  goal: string;
  status: StudySessionStatus;
  actualDurationMinutes: number | null;
}

export interface StudySessionRecord extends Omit<StudySessionInput, "moduleId" | "topicId" | "materialId" | "goal"> {
  id: string;
  moduleId?: string;
  topicId?: string;
  materialId?: string;
  goal?: string;
  createdAt: string;
  updatedAt: string;
}

export function emptyStudySessionInput(): StudySessionInput {
  return {
    moduleId: "",
    topicId: "",
    materialId: "",
    title: "",
    plannedStart: "",
    plannedDurationMinutes: 60,
    goal: "",
    status: "planned",
    actualDurationMinutes: null,
  };
}
