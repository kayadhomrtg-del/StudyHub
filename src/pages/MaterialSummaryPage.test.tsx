import { render, screen, waitFor } from "@testing-library/react";
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
  "The water cycle moves water through evaporation, condensation, and precipitation.";
const OTHER_TEXT = "This other material must not be used for the summary.";

function createMaterial(
  id: string,
  originalFileName: string,
  options: { content: string; mimeType?: string },
): MaterialRecord {
  const dot = originalFileName.lastIndexOf(".");
  return {
    id,
    title: dot > 0 ? originalFileName.slice(0, dot) : originalFileName,
    originalFileName,
    mimeType: options.mimeType ?? "text/plain",
    ...(dot > 0 ? { extension: originalFileName.slice(dot + 1).toLowerCase() } : {}),
    sizeBytes: new TextEncoder().encode(options.content).byteLength,
    tags: [],
    status: "not-started",
    isFavorite: false,
    createdAt: "2026-02-01T00:00:00.000Z",
    updatedAt: "2026-02-02T00:00:00.000Z",
  };
}

async function saveMaterial(material: MaterialRecord, content: string) {
  const bytes = new TextEncoder().encode(content).buffer;
  await moduleDatabase.materials.add(material);
  await moduleDatabase.storedFiles.add({ id: material.id, bytes });
}

function createNote(
  id: string,
  material: MaterialRecord,
  markdown: string,
): NoteRecord {
  return {
    id,
    title: `Notes for ${material.title}`,
    markdown,
    tags: [],
    isPinned: false,
    link: { type: "material", id: material.id, label: material.title },
    createdAt: "2026-02-01T00:00:00.000Z",
    updatedAt: "2026-02-03T00:00:00.000Z",
  };
}

function renderSummaryRoute(materialId: string) {
  return render(
    <MemoryRouter initialEntries={[`/materials/${materialId}/summary`]}>
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

describe("MaterialSummaryPage", () => {
  it("resolves the route and loads the exact selected material", async () => {
    const selected = createMaterial("selected-material", "water-cycle.txt", {
      content: SOURCE_TEXT,
    });
    const other = createMaterial("other-material", "other.txt", {
      content: OTHER_TEXT,
    });
    await saveMaterial(selected, SOURCE_TEXT);
    await saveMaterial(other, OTHER_TEXT);
    await moduleDatabase.notes.add(
      createNote("note-selected", selected, "NOTE-FOR-SELECTED-MATERIAL"),
    );
    await moduleDatabase.notes.add(
      createNote("note-other", other, "NOTE-FOR-OTHER-MATERIAL"),
    );
    const user = userEvent.setup();

    renderSummaryRoute(selected.id);

    expect(
      await screen.findByRole("heading", { name: /Summarize .*water-cycle/ }),
    ).toBeInTheDocument();
    const notes = await screen.findByLabelText("Personal notes (stored locally)");
    await waitFor(() =>
      expect(notes).toHaveValue("NOTE-FOR-SELECTED-MATERIAL"),
    );

    await user.click(screen.getByRole("button", { name: "Use local fallback" }));

    expect(
      await screen.findByRole("heading", { name: "Local fallback summary" }),
    ).toBeInTheDocument();
    expect(screen.getByText(SOURCE_TEXT)).toBeInTheDocument();
    expect(screen.queryByText(OTHER_TEXT)).not.toBeInTheDocument();
  });

  it("reports blocked production preparation and keeps a zero-network local fallback", async () => {
    const material = createMaterial("blocked-material", "blocked-source.txt", {
      content: SOURCE_TEXT,
    });
    await saveMaterial(material, SOURCE_TEXT);
    const stub = createStubAiFetch({
      prepare: {
        kind: "error",
        code: "terms_not_eligible",
        message: "Provider eligibility is unresolved.",
      },
    });
    vi.stubGlobal("fetch", stub.fetch);
    const user = userEvent.setup();

    renderSummaryRoute(material.id);

    expect(
      await screen.findByRole("heading", { name: /Summarize .*blocked-source/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Provider dispatch is currently blocked"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Prepare exact payload" }));

    expect(await screen.findByText("Not sent")).toBeInTheDocument();
    expect(
      screen.getByText("Local proxy message: Provider eligibility is unresolved."),
    ).toBeInTheDocument();
    expect(stub.calls).toHaveLength(1);
    expect((stub.calls[0].body as { text: string }).text).toBe(SOURCE_TEXT);

    await user.click(screen.getByRole("button", { name: "Use local fallback" }));

    expect(
      await screen.findByRole("heading", { name: "Local fallback summary" }),
    ).toBeInTheDocument();
    expect(screen.getByText(SOURCE_TEXT)).toBeInTheDocument();
    expect(stub.calls).toHaveLength(1);
  });

  it("handles a missing material gracefully", async () => {
    renderSummaryRoute("missing-material");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Material not found",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "This material could not be found in local storage.",
    );
    expect(screen.getByRole("link", { name: "Back to materials" })).toHaveAttribute(
      "href",
      "/materials",
    );
    expect(
      screen.queryByRole("button", { name: "Prepare exact payload" }),
    ).not.toBeInTheDocument();
  });

  it("explains why an unsupported file type cannot be summarized", async () => {
    const material = createMaterial("unsupported-material", "diagram.png", {
      content: "not really an image",
      mimeType: "image/png",
    });
    await saveMaterial(material, "not really an image");

    renderSummaryRoute(material.id);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Summary not available for this file type",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Only text, PDF, Word, PowerPoint, and spreadsheet files can be summarized locally.",
    );
    expect(screen.getByRole("link", { name: "Back to material" })).toHaveAttribute(
      "href",
      `/materials/${material.id}`,
    );
    expect(
      screen.queryByRole("button", { name: "Prepare exact payload" }),
    ).not.toBeInTheDocument();
  });

  it("handles missing original bytes without offering a summary", async () => {
    const material = createMaterial("missing-bytes", "missing-bytes.txt", {
      content: SOURCE_TEXT,
    });
    await moduleDatabase.materials.add(material);

    renderSummaryRoute(material.id);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Original file is missing",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "The original file bytes are missing from local storage",
    );
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Prepare exact payload" }),
    ).not.toBeInTheDocument();
  });

  it("handles extraction failure gracefully", async () => {
    const material = createMaterial("invalid-utf8", "invalid-utf8.txt", {
      content: "",
    });
    await moduleDatabase.materials.add(material);
    await moduleDatabase.storedFiles.add({
      id: material.id,
      bytes: new Uint8Array([0xff, 0xfe, 0xfd]).buffer,
    });

    renderSummaryRoute(material.id);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Summary source unavailable",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "This text file is not valid UTF-8",
    );
    expect(screen.getByRole("link", { name: "Back to material" })).toHaveAttribute(
      "href",
      `/materials/${material.id}`,
    );
    expect(
      screen.queryByRole("button", { name: "Prepare exact payload" }),
    ).not.toBeInTheDocument();
  });
});
