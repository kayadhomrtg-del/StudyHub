import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { moduleDatabase } from "../features/modules/moduleDatabase";
import { TasksPage } from "./TasksPage";

beforeEach(async () => {
  await Promise.all([
    moduleDatabase.tasks.clear(),
    moduleDatabase.notes.clear(),
    moduleDatabase.materials.clear(),
    moduleDatabase.storedFiles.clear(),
    moduleDatabase.topics.clear(),
    moduleDatabase.modules.clear(),
  ]);
});

function renderTasks() {
  return render(<MemoryRouter><TasksPage /></MemoryRouter>);
}

describe("TasksPage", () => {
  it("creates an undated task, filters it, and completes then reopens it", async () => {
    const user = userEvent.setup();
    renderTasks();
    await user.click(await screen.findByRole("button", { name: "New task" }));
    await user.type(await screen.findByRole("textbox", { name: "Title" }), "Review lecture notes");
    await user.click(screen.getByRole("button", { name: "Create task" }));
    const task = await screen.findByRole("heading", { name: "Review lecture notes" });
    expect(task).toBeInTheDocument();
    expect(screen.queryByText("No upcoming deadlines. Add a dated task to see it here.")).not.toBeInTheDocument();
    const article = task.closest("article");
    expect(article).not.toBeNull();
    const statusSelect = within(article as HTMLElement).getByRole("combobox", { name: "Status for Review lecture notes" });
    await user.selectOptions(statusSelect, "blocked");
    await waitFor(() => expect(statusSelect).toHaveValue("blocked"));
    await user.click(screen.getByRole("button", { name: "Mark Review lecture notes complete" }));
    expect(await screen.findByRole("button", { name: "Reopen Review lecture notes" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reopen Review lecture notes" }));
    expect(await screen.findByRole("button", { name: "Mark Review lecture notes complete" })).toBeInTheDocument();

    await user.type(screen.getByRole("searchbox", { name: "Search tasks" }), "not present");
    expect(screen.getByText("No matching tasks")).toBeInTheDocument();
    await user.clear(screen.getByRole("searchbox", { name: "Search tasks" }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Filter by status" }), "not-started");
    expect(screen.getByRole("heading", { name: "Review lecture notes" })).toBeInTheDocument();
  });

  it("requires confirmation before deleting a task", async () => {
    const user = userEvent.setup();
    renderTasks();
    await user.click(await screen.findByRole("button", { name: "New task" }));
    await user.type(await screen.findByRole("textbox", { name: "Title" }), "Delete me later");
    await user.click(screen.getByRole("button", { name: "Create task" }));
    await screen.findByRole("heading", { name: "Delete me later" });
    const item = await moduleDatabase.tasks.toCollection().first();
    expect(item).toBeDefined();
    await user.click(screen.getByRole("button", { name: "Delete Delete me later" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Delete this task?" });
    expect(await moduleDatabase.tasks.get(item!.id)).toBeDefined();
    await user.click(within(dialog).getByRole("button", { name: "Delete task" }));
    await waitFor(async () => expect(await moduleDatabase.tasks.get(item!.id)).toBeUndefined());
  });
});
