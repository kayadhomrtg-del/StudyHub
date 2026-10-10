import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { moduleDatabase } from "../features/modules/moduleDatabase";
import { MaterialsPage } from "./MaterialsPage";

beforeEach(async () => {
  await Promise.all([
    moduleDatabase.modules.clear(),
    moduleDatabase.topics.clear(),
    moduleDatabase.materials.clear(),
    moduleDatabase.storedFiles.clear(),
  ]);
  await moduleDatabase.modules.add({
    id: "materials-page-module",
    name: "Environmental Science",
    code: "ENV-201",
    isArchived: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });
  await moduleDatabase.topics.add({
    id: "materials-page-topic",
    moduleId: "materials-page-module",
    title: "Climate systems",
    sortOrder: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });
});

describe("MaterialsPage", () => {
  it("shows imported materials and persists assignment, tags, favorite, and status", async () => {
    const user = userEvent.setup();
    const { container } = render(<MaterialsPage />);

    const moduleSelect = await screen.findByLabelText("Module (optional)");
    await screen.findByRole("option", { name: "Environmental Science (ENV-201)" });
    await user.selectOptions(moduleSelect, "materials-page-module");
    await user.selectOptions(
      await screen.findByLabelText("Topic (optional)"),
      "materials-page-topic",
    );
    await user.type(screen.getByLabelText("Tags (comma separated)"), "lecture, climate");

    const input = container.querySelector('input[type="file"]');
    if (!(input instanceof HTMLInputElement)) {
      throw new Error("The multiple-file input was not rendered.");
    }
    fireEvent.change(input, {
      target: {
        files: [new File(["climate notes"], "Field guide.txt", { type: "text/plain" })],
      },
    });

    const card = await screen.findByRole("article");
    expect(card).toHaveTextContent("Field guide");
    expect(card).toHaveTextContent("Field guide.txt");
    expect(card).toHaveTextContent("Environmental Science (ENV-201)");
    expect(card).toHaveTextContent("lecture");
    expect(card).toHaveTextContent("climate");

    await user.click(screen.getByRole("button", { name: "Add Field guide" }));
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Study status for Field guide" }),
      "completed",
    );
    await waitFor(async () => {
      const material = await moduleDatabase.materials.toCollection().first();
      expect(material).toMatchObject({
        moduleId: "materials-page-module",
        topicId: "materials-page-topic",
        tags: ["lecture", "climate"],
        isFavorite: true,
        status: "completed",
      });
    });
  });
});
