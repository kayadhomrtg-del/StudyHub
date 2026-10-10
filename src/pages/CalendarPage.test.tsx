import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { moduleDatabase } from "../features/modules/moduleDatabase";
import { emptyTaskInput, taskService } from "../features/tasks/TaskService";
import { studySessionService } from "../features/studySessions/StudySessionService";
import { emptyStudySessionInput } from "../features/studySessions/studySession";
import { toLocalDateTimeInput } from "../features/studySessions/localDateTime";
import { CalendarPage } from "./CalendarPage";

beforeEach(async () => {
  await Promise.all([
    moduleDatabase.studySessions.clear(),
    moduleDatabase.tasks.clear(),
    moduleDatabase.materials.clear(),
    moduleDatabase.topics.clear(),
    moduleDatabase.modules.clear(),
  ]);
  const timestamp = new Date().toISOString();
  await moduleDatabase.modules.bulkAdd([
    { id: "cal-bio", name: "Biology", code: "BIO-1", isArchived: false, createdAt: timestamp, updatedAt: timestamp },
    { id: "cal-chem", name: "Chemistry", code: "CHEM-1", isArchived: false, createdAt: timestamp, updatedAt: timestamp },
  ]);
});

describe("CalendarPage", () => {
  it("shows tasks and sessions in the selected-day agenda and links each item to its source area", async () => {
    const when = new Date();
    when.setDate(when.getDate() + 2);
    when.setHours(14, 0, 0, 0);
    const plannedStart = toLocalDateTimeInput(when.toISOString());
    const task = await taskService.create({
      ...emptyTaskInput(),
      title: "Biology essay deadline",
      moduleId: "cal-bio",
      dueAt: when.toISOString(),
    });
    await moduleDatabase.materials.add({
      id: "cal-material",
      title: "Biology notes",
      originalFileName: "bio-notes.pdf",
      mimeType: "application/pdf",
      sizeBytes: 0,
      moduleId: "cal-bio",
      tags: [],
      status: "not-started",
      isFavorite: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const session = await studySessionService.create({
      ...emptyStudySessionInput(),
      moduleId: "cal-bio",
      materialId: "cal-material",
      title: "Review biology",
      plannedStart,
      plannedDurationMinutes: 50,
    });
    await studySessionService.create({
      ...emptyStudySessionInput(),
      moduleId: "cal-chem",
      title: "Chemistry practice",
      plannedStart,
    });

    render(<MemoryRouter><CalendarPage /></MemoryRouter>);
    await screen.findByRole("heading", { name: "Calendar" });
    const labelDate = new Intl.DateTimeFormat(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    }).format(when);
    fireEvent.click(screen.getByRole("button", {
      name: `Select ${labelDate}, 3 calendar items`,
    }));

    expect(await screen.findByRole("link", { name: "Biology essay deadline" }))
      .toHaveAttribute("href", `/tasks?taskId=${encodeURIComponent(task.id)}`);
    expect(screen.getByRole("link", { name: "Review biology" }))
      .toHaveAttribute("href", `/planner?sessionId=${encodeURIComponent(session.id)}`);
    expect(screen.getByRole("link", { name: "Chemistry practice" })).toHaveAttribute(
      "href",
      expect.stringMatching(/^\/planner\?sessionId=/),
    );
    expect(screen.queryByRole("button", { name: /Complete|Skip|Edit|Delete/ })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Filter by module"), { target: { value: "cal-bio" } });
    expect(screen.getByRole("link", { name: "Review biology" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Chemistry practice" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Filter by item type"), { target: { value: "sessions" } });
    expect(screen.queryByRole("link", { name: "Biology essay deadline" })).not.toBeInTheDocument();
  });
});
