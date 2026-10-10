import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { moduleDatabase } from "../modules/moduleDatabase";
import { ModuleTopics } from "./ModuleTopics";

beforeEach(async () => {
  await Promise.all([
    moduleDatabase.modules.clear(),
    moduleDatabase.topics.clear(),
    moduleDatabase.materials.clear(),
    moduleDatabase.storedFiles.clear(),
  ]);
  await moduleDatabase.modules.add({
    id: "module-topics-ui",
    name: "World History",
    code: "HIS-100",
    isArchived: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });
});

describe("ModuleTopics", () => {
  it("adds, renames, reorders, and persists topics", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<ModuleTopics moduleId="module-topics-ui" />);

    const titleInput = await screen.findByRole("textbox", { name: "New topic name" });
    await user.type(titleInput, "Week one");
    await user.type(screen.getByRole("textbox", { name: "New topic description (optional)" }), "An overview of early events");
    await user.click(screen.getByRole("button", { name: "Add topic" }));
    await screen.findByText("Week one");
    expect(await moduleDatabase.topics.where("moduleId").equals("module-topics-ui").first()).toMatchObject({
      description: "An overview of early events",
    });

    await user.clear(titleInput);
    await user.type(titleInput, "Week two");
    await user.click(screen.getByRole("button", { name: "Add topic" }));
    await screen.findByText("Week two");

    const weekTwo = screen.getByText("Week two").closest("li");
    if (!weekTwo) throw new Error("Topic list item was not rendered.");
    await user.click(within(weekTwo).getByRole("button", { name: "Move Week two up" }));
    await waitFor(() => {
      const topicItems = screen.getAllByRole("listitem");
      expect(topicItems[0]).toHaveTextContent("Week two");
      expect(topicItems[1]).toHaveTextContent("Week one");
    });

    const weekOne = screen.getByText("Week one").closest("li");
    if (!weekOne) throw new Error("Topic list item was not rendered.");
    await user.click(within(weekOne).getByRole("button", { name: "Rename Week one" }));
    const renameInput = screen.getByRole("textbox", { name: "Rename topic" });
    await user.clear(renameInput);
    await user.type(renameInput, "Foundations");
    await user.click(screen.getByRole("button", { name: "Save topic Week one" }));
    await screen.findByText("Foundations");

    unmount();
    render(<ModuleTopics moduleId="module-topics-ui" />);
    const persistedItems = await screen.findAllByRole("listitem");
    expect(persistedItems[0]).toHaveTextContent("Week two");
    expect(persistedItems[1]).toHaveTextContent("Foundations");
    expect(await moduleDatabase.topics.count()).toBe(2);
  });
});
