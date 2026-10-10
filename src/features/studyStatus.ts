export const studyStatuses = ["not-started", "in-progress", "completed"] as const;

export type StudyStatus = (typeof studyStatuses)[number];

export const studyStatusLabels: Record<StudyStatus, string> = {
  "not-started": "Not started",
  "in-progress": "In progress",
  completed: "Completed",
};
