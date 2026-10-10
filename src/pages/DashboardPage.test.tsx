import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { moduleDatabase } from "../features/modules/moduleDatabase";
import { emptyTaskInput, taskService } from "../features/tasks/TaskService";
import { DashboardPage } from "./DashboardPage";

beforeEach(async () => {
  await moduleDatabase.tasks.clear();
});

describe("DashboardPage deadlines", () => {
  it("shows only real upcoming open task deadlines", async () => {
    await taskService.create({
      ...emptyTaskInput(),
      title: "Real upcoming deadline",
      dueAt: new Date(Date.now() + 86_400_000).toISOString(),
    });
    await taskService.create({
      ...emptyTaskInput(),
      title: "Overdue task",
      dueAt: new Date(Date.now() - 86_400_000).toISOString(),
    });
    await taskService.create({
      ...emptyTaskInput(),
      title: "Completed future task",
      dueAt: new Date(Date.now() + 172_800_000).toISOString(),
      status: "completed",
    });
    await taskService.create({ ...emptyTaskInput(), title: "Undated task" });

    render(<MemoryRouter><DashboardPage /></MemoryRouter>);
    expect(await screen.findByText("Real upcoming deadline")).toBeInTheDocument();
    expect(screen.queryByText("Overdue task")).not.toBeInTheDocument();
    expect(screen.queryByText("Completed future task")).not.toBeInTheDocument();
    expect(screen.queryByText("Undated task")).not.toBeInTheDocument();
  });
});
