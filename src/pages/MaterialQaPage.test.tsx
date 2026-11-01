import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppRoutes } from "../App";
import { ThemeProvider } from "../components/theme/ThemeProvider";
import { createStubAiFetch } from "../features/ai/testing/stubAiFetch";
import type { MaterialRecord } from "../features/materials/material";
import { moduleDatabase } from "../features/modules/moduleDatabase";
import type { NoteRecord } from "../features/notes/note";

const SOURCE_TEXT =
  "Evaporation changes liquid water into vapor. Condensation forms clouds.";
const PRIVATE_NOTE = "PRIVATE-NOTE-MUST-NOT-BE-SENT";

function createMaterial(id: string): MaterialRecord {
  return {
    id,
    title: "Water cycle",
    originalFileName: "water-cycle.txt",
    mimeType: "text/plain",
    extension: "txt",
    sizeBytes: new TextEncoder().encode(SOURCE_TEXT).byteLength,
    tags: [],
    status: "not-started",
    isFavorite: false,
    createdAt: "2026-02-01T00:00:00.000Z",
    updatedAt: "2026-02-02T00:00:00.000Z",
  };
}

function createNote(material: MaterialRecord): NoteRecord {
  return {
    id: "private-note",
    title: "Private study note",
    markdown: PRIVATE_NOTE,
    tags: [],
    isPinned: false,
    link: { type: "material", id: material.id, label: material.title },
    createdAt: "2026-02-01T00:00:00.000Z",
    updatedAt: "2026-02-03T00:00:00.000Z",
  };
}

function renderQaRoute(materialId: string) {
  return render(
    <MemoryRouter initialEntries={[`/materials/${materialId}/qa`]}>
      <ThemeProvider>
        <AppRoutes />
      </ThemeProvider>
    </MemoryRouter>,
  );
}

beforeEach(async () => {
  await Promise.all([
    moduleDatabase.materials.clear(),
    moduleDatabase.storedFiles.clear(),
    moduleDatabase.notes.clear(),
  ]);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("MaterialQaPage", () => {
  it("loads the selected material and excludes linked personal notes from the payload", async () => {
    const material = createMaterial("qa-material");
    const bytes = new TextEncoder().encode(SOURCE_TEXT).buffer;
    await moduleDatabase.materials.add(material);
    await moduleDatabase.storedFiles.add({ id: material.id, bytes });
    await moduleDatabase.notes.add(createNote(material));
    const stub = createStubAiFetch();
    vi.stubGlobal("fetch", stub.fetch);
    const user = userEvent.setup();

    renderQaRoute(material.id);

    expect(await screen.findByRole("heading", { name: /Ask about “Water cycle”/ })).toBeInTheDocument();
    await user.type(
      screen.getByLabelText("Question about this material"),
      "How does condensation work?",
    );
    await user.click(screen.getByRole("button", { name: "Prepare exact Q&A payload" }));
    expect(await screen.findByRole("heading", { name: "Exact outbound Q&A payload" })).toBeInTheDocument();

    const requestBody = JSON.stringify(stub.calls[0].body);
    expect(stub.calls).toHaveLength(1);
    expect(requestBody).toContain(SOURCE_TEXT);
    expect(requestBody).toContain("How does condensation work?");
    expect(requestBody).not.toContain(PRIVATE_NOTE);
    expect(requestBody).not.toContain(material.title);
  });

  it("reports unsupported material types before offering a request", async () => {
    const material = {
      ...createMaterial("qa-image"),
      originalFileName: "diagram.png",
      mimeType: "image/png",
      extension: "png",
    };
    const bytes = new TextEncoder().encode("not an image").buffer;
    await moduleDatabase.materials.add(material);
    await moduleDatabase.storedFiles.add({ id: material.id, bytes });
    const stub = createStubAiFetch();
    vi.stubGlobal("fetch", stub.fetch);

    renderQaRoute(material.id);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Q&A not available for this file type",
    );
    expect(stub.calls).toHaveLength(0);
  });
});
