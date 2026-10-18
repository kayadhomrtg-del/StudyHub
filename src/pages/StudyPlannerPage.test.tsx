import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { moduleDatabase } from "../features/modules/moduleDatabase";
import { studySessionService } from "../features/studySessions/StudySessionService";
import { emptyStudySessionInput } from "../features/studySessions/studySession";
import { toLocalDateTimeInput } from "../features/studySessions/localDateTime";
import { StudyPlannerPage } from "./StudyPlannerPage";

beforeEach(async () => {
  await Promise.all([
    moduleDatabase.studySessions.clear(),
    moduleDatabase.materials.clear(),
    moduleDatabase.topics.clear(),
    moduleDatabase.modules.clear(),
  ]);
  const timestamp = new Date().toISOString();
  await moduleDatabase.modules.add({
    id: "planner-module",
    name: "Chemistry",
    code: "CHEM-201",
    isArchived: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
});

describe("StudyPlannerPage", () => {
  it("creates study sessions from the dedicated planner area", async () => {
    const when = new Date();
    when.setDate(when.getDate() + 1);
    when.setHours(10, 0, 0, 0);

    render(<MemoryRouter><StudyPlannerPage /></MemoryRouter>);
    await screen.findByRole("heading", { name: "Study planner" });
    fireEvent.click(screen.getByRole("button", { name: "Plan session" }));
    const form = within(screen.getByRole("region", { name: "Plan a study session" }));
    fireEvent.change(form.getByLabelText("Title"), { target: { value: "Review chemistry" } });
    fireEvent.change(form.getByLabelText("Session module"), { target: { value: "planner-module" } });
    fireEvent.change(form.getByLabelText("Planned start"), {
      target: { value: toLocalDateTimeInput(when.toISOString()) },
    });
    fireEvent.click(form.getByRole("button", { name: "Plan session" }));

    await waitFor(async () => {
      await expect(studySessionService.getAll()).resolves.toEqual([
        expect.objectContaining({
          title: "Review chemistry",
          moduleId: "planner-module",
          plannedStart: when.toISOString(),
        }),
      ]);
    });
    expect(screen.getByRole("link", { name: /Open calendar/ })).toHaveAttribute("href", "/calendar");
  });

  it("hides the Skip button for completed sessions", async () => {
    const timestamp = new Date().toISOString();
    await moduleDatabase.studySessions.add({
      id: "completed-session",
      moduleId: "planner-module",
      title: "Completed session",
      plannedStart: timestamp,
      plannedDurationMinutes: 60,
      status: "completed",
      actualDurationMinutes: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    await moduleDatabase.studySessions.add({
      id: "planned-session",
      moduleId: "planner-module",
      title: "Planned session",
      plannedStart: timestamp,
      plannedDurationMinutes: 60,
      status: "planned",
      actualDurationMinutes: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    render(<MemoryRouter><StudyPlannerPage /></MemoryRouter>);
    await screen.findByRole("heading", { name: "Study sessions" });

    const completedItem = screen.getByText("Completed session").closest("li");
    expect(completedItem).not.toBeNull();
    expect(
      within(completedItem as HTMLElement).queryByRole("button", {
        name: "Skip",
      }),
    ).not.toBeInTheDocument();
    expect(
      within(completedItem as HTMLElement).queryByRole("button", {
        name: "Complete",
      }),
    ).not.toBeInTheDocument();

    const plannedItem = screen.getByText("Planned session").closest("li");
    expect(
      within(plannedItem as HTMLElement).getByRole("button", { name: "Skip" }),
    ).toBeInTheDocument();
  });

  it("opens the requested session for editing and persists changes and status", async () => {
    const start = new Date();
    start.setDate(start.getDate() + 2);
    const session = await studySessionService.create({
      ...emptyStudySessionInput(),
      moduleId: "planner-module",
      title: "Original session",
      plannedStart: toLocalDateTimeInput(start.toISOString()),
    });

    render(<MemoryRouter initialEntries={[`/planner?sessionId=${session.id}`]}><StudyPlannerPage /></MemoryRouter>);
    const editForm = await screen.findByRole("region", { name: "Edit study session" });
    fireEvent.change(within(editForm).getByLabelText("Title"), { target: { value: "Revised session" } });
    fireEvent.click(within(editForm).getByRole("button", { name: "Save session" }));

    await waitFor(async () => {
      await expect(studySessionService.getById(session.id)).resolves.toMatchObject({ title: "Revised session" });
    });
    fireEvent.click(screen.getByRole("button", { name: "Complete" }));
    await waitFor(async () => {
      await expect(studySessionService.getById(session.id)).resolves.toMatchObject({ status: "completed" });
    });
  });
});
