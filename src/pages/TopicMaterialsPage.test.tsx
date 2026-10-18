import { render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { moduleDatabase } from "../features/modules/moduleDatabase";
import { TopicMaterialsPage } from "./TopicMaterialsPage";

const timestamp = "2026-01-01T00:00:00.000Z";

beforeEach(async () => {
  await Promise.all([
    moduleDatabase.modules.clear(),
    moduleDatabase.topics.clear(),
    moduleDatabase.materials.clear(),
    moduleDatabase.storedFiles.clear(),
  ]);
  await moduleDatabase.modules.add({
    id: "topic-materials-module",
    name: "Biology",
    code: "BIO-101",
    isArchived: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  await moduleDatabase.modules.add({
    id: "other-module",
    name: "Chemistry",
    code: "CHEM-201",
    isArchived: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  await moduleDatabase.topics.add({
    id: "topic-materials-topic",
    moduleId: "topic-materials-module",
    title: "Cell biology",
    sortOrder: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  await moduleDatabase.materials.add({
    id: "topic-material-1",
    title: "Cell structure notes",
    originalFileName: "Cell structure notes.pdf",
    mimeType: "application/pdf",
    extension: "pdf",
    sizeBytes: 1234,
    moduleId: "topic-materials-module",
    topicId: "topic-materials-topic",
    tags: [],
    status: "not-started",
    isFavorite: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  await moduleDatabase.materials.add({
    id: "topic-material-2",
    title: "Genetics reading",
    originalFileName: "Genetics reading.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    extension: "docx",
    sizeBytes: 5678,
    moduleId: "topic-materials-module",
    topicId: "topic-materials-topic",
    tags: ["lecture"],
    status: "in-progress",
    isFavorite: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  await moduleDatabase.topics.add({
    id: "other-topic",
    moduleId: "topic-materials-module",
    title: "Ecology",
    sortOrder: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  await moduleDatabase.materials.add({
    id: "other-topic-material",
    title: "Other topic material",
    originalFileName: "Other topic material.txt",
    mimeType: "text/plain",
    extension: "txt",
    sizeBytes: 90,
    moduleId: "topic-materials-module",
    topicId: "other-topic",
    tags: [],
    status: "not-started",
    isFavorite: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  await moduleDatabase.materials.add({
    id: "other-module-material",
    title: "Other module material",
    originalFileName: "Other module material.md",
    mimeType: "text/markdown",
    extension: "md",
    sizeBytes: 90,
    moduleId: "other-module",
    topicId: undefined,
    tags: [],
    status: "not-started",
    isFavorite: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
});

function renderTopicMaterials(initialEntries: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntries]}>
      <Routes>
        <Route
          path="/modules/:moduleId/topics/:topicId/materials"
          element={<TopicMaterialsPage />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("TopicMaterialsPage", () => {
  it("shows the topic title, parent module, and only that topic's materials", async () => {
    renderTopicMaterials(
      "/modules/topic-materials-module/topics/topic-materials-topic/materials",
    );

    await screen.findByRole("heading", { name: "Cell biology" });
    const firstCard = screen
      .getByText("Cell structure notes")
      .closest("article");
    if (!firstCard) throw new Error("Material card was not rendered.");
    expect(
      within(firstCard as HTMLElement).getByText(/Biology \(BIO-101\)/, {
        exact: false,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Cell structure notes")).toBeInTheDocument();
    expect(screen.getByText("Genetics reading")).toBeInTheDocument();

    expect(screen.queryByText("Other topic material")).not.toBeInTheDocument();
    expect(screen.queryByText("Other module material")).not.toBeInTheDocument();

    const openLink = screen.getByRole("link", { name: /Open Cell structure notes/ });
    expect(openLink).toHaveAttribute("href", "/materials/topic-material-1");

    const backLink = screen.getByRole("link", { name: /Back to Biology/ });
    expect(backLink).toHaveAttribute("href", "/modules/topic-materials-module");
  });

  it("reports an error for a missing topic", async () => {
    renderTopicMaterials(
      "/modules/topic-materials-module/topics/unknown-topic/materials",
    );

    await screen.findByText(/This topic may have been deleted/, { exact: false });
    const backLink = screen.getByRole("link", { name: /Back to module/ });
    expect(backLink).toHaveAttribute("href", "/modules/topic-materials-module");
  });

  it("rejects a topic that belongs to another module", async () => {
    renderTopicMaterials(
      "/modules/other-module/topics/topic-materials-topic/materials",
    );

    await screen.findByText(
      /This topic does not belong to the selected module/,
      { exact: false },
    );
  });
});
