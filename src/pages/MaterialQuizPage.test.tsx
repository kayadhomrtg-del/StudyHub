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
  "Evaporation moves water into the atmosphere. Condensation forms clouds.";
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

function renderQuizRoute(materialId: string) {
  return render(
    <MemoryRouter initialEntries={[`/materials/${materialId}/quiz`]}>
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

describe("MaterialQuizPage", () => {
  it("loads only the selected material text and excludes linked personal notes", async () => {
    const material = createMaterial("quiz-material");
    const bytes = new TextEncoder().encode(SOURCE_TEXT).buffer;
    await moduleDatabase.materials.add(material);
    await moduleDatabase.storedFiles.add({ id: material.id, bytes });
    await moduleDatabase.notes.add(createNote(material));
    const stub = createStubAiFetch();
    vi.stubGlobal("fetch", stub.fetch);
    const user = userEvent.setup();

    renderQuizRoute(material.id);

    expect(
      await screen.findByRole("heading", { name: /Quiz yourself on “Water cycle”/ }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Prepare exact payload" }));
    expect(await screen.findByRole("heading", { name: "Exact outbound quiz payload" })).toBeInTheDocument();

    expect(stub.calls).toHaveLength(1);
    expect(stub.calls[0].body).toMatchObject({
      feature: "quiz",
      text: SOURCE_TEXT,
    });
    expect(JSON.stringify(stub.calls[0].body)).not.toContain(PRIVATE_NOTE);
    expect(JSON.stringify(stub.calls[0].body)).not.toContain(material.title);
  });

  it("reports a missing material without attempting a request", async () => {
    const stub = createStubAiFetch();
    vi.stubGlobal("fetch", stub.fetch);

    renderQuizRoute("missing-material");

    expect(await screen.findByRole("alert")).toHaveTextContent("Material not found");
    expect(stub.calls).toHaveLength(0);
  });
});
