import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { moduleDatabase } from "../features/modules/moduleDatabase";
import { emptyTaskInput, taskService } from "../features/tasks/TaskService";
import { DashboardPage } from "./DashboardPage";

beforeEach(async () => {
  await Promise.all([
    moduleDatabase.tasks.clear(),
    moduleDatabase.materials.clear(),
    moduleDatabase.modules.clear(),
  ]);
});

describe("DashboardPage deadlines", () => {
  it("shows real module/material/completion data and only upcoming open task deadlines", async () => {
    const timestamp = new Date().toISOString();
    await moduleDatabase.modules.add({
      id: "dashboard-module", name: "Local Biology", code: "BIO-100", isArchived: false,
      createdAt: timestamp, updatedAt: timestamp,
    });
    await moduleDatabase.modules.add({
      id: "dashboard-archived-module", name: "Archived Biology", code: "BIO-099", isArchived: true,
      createdAt: timestamp, updatedAt: timestamp,
    });
    await moduleDatabase.materials.add({
      id: "dashboard-material", title: "Completed lab", originalFileName: "lab.pdf",
      mimeType: "application/pdf", sizeBytes: 5, tags: [], status: "completed",
      isFavorite: false, createdAt: timestamp, updatedAt: timestamp, lastOpenedAt: timestamp,
    });
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
    expect(screen.getByRole("link", { name: /Local Biology BIO-100/ })).toHaveAttribute("href", "/modules/dashboard-module");
    expect(screen.queryByText("Archived Biology")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Completed lab lab\.pdf/ })).toHaveAttribute("href", "/materials/dashboard-material");
    expect(screen.getByText((_content, element) => element?.textContent === "1 / 4 tasks completed or submitted")).toBeInTheDocument();
    expect(screen.getByText((_content, element) => element?.textContent === "1 / 1 materials marked completed")).toBeInTheDocument();
  });

  it("shows accurate zero-data states instead of fabricated activity", async () => {
    render(<MemoryRouter><DashboardPage /></MemoryRouter>);
    expect(await screen.findByText("No active modules yet.")).toBeInTheDocument();
    expect(screen.getByText("No upcoming tasks with a due date.")).toBeInTheDocument();
    expect(screen.getByText("No materials yet")).toBeInTheDocument();
    expect(screen.getByText((_content, element) => element?.textContent === "0 / 0 tasks completed or submitted")).toBeInTheDocument();
    expect(screen.getByText((_content, element) => element?.textContent === "0 / 0 materials marked completed")).toBeInTheDocument();
  });
});
