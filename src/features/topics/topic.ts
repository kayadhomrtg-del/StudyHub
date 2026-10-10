export interface TopicRecord {
  id: string;
  moduleId: string;
  title: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface TopicInput {
  title: string;
}
