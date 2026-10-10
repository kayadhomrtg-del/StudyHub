import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { moduleDatabase } from "../features/modules/moduleDatabase";
import type { MaterialRecord } from "../features/materials/material";
import { materialService } from "../features/materials/MaterialService";
import { openPdf } from "../features/materials/pdfLoader";
import { MaterialFileViewer } from "../features/materials/MaterialFileViewer";
import { MaterialViewerPage } from "./MaterialViewerPage";
import type { PdfDocument } from "../features/materials/pdfLoader";

vi.mock("../features/materials/pdfLoader", () => ({
  openPdf: vi.fn(),
}));

const moduleRecord = {
  id: "viewer-module",
  name: "Local Studies",
  code: "LOC-101",
  isArchived: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};
const topicRecord = {
  id: "viewer-topic",
  moduleId: moduleRecord.id,
  title: "Reading week",
  sortOrder: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function createMaterial(
  id: string,
  originalFileName: string,
  options: { content: string; mimeType?: string; topic?: boolean; sizeBytes?: number },
): MaterialRecord {
  const dot = originalFileName.lastIndexOf(".");
  return {
    id,
    title: dot > 0 ? originalFileName.slice(0, dot) : originalFileName,
    originalFileName,
    mimeType: options.mimeType ?? "text/plain",
    ...(dot > 0 ? { extension: originalFileName.slice(dot + 1).toLowerCase() } : {}),
    sizeBytes: options.sizeBytes ?? new TextEncoder().encode(options.content).byteLength,
    ...(options.topic ? { moduleId: moduleRecord.id, topicId: topicRecord.id } : {}),
    tags: ["week one"],
    status: "not-started",
    isFavorite: false,
    createdAt: id === "first" ? "2026-02-01T00:00:00.000Z" : "2026-02-02T00:00:00.000Z",
    updatedAt: "2026-02-02T00:00:00.000Z",
  };
}

async function saveMaterial(material: MaterialRecord, text: string) {
  const bytes = new TextEncoder().encode(text).buffer;
  await moduleDatabase.materials.add(material);
  await moduleDatabase.storedFiles.add({ id: material.id, bytes });
}

function renderViewer(id: string) {
  return render(
    <MemoryRouter initialEntries={[`/materials/${id}`]}>
      <Routes>
        <Route path="/materials/:materialId" element={<MaterialViewerPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(async () => {
  vi.mocked(openPdf).mockReset();
  await Promise.all([
    moduleDatabase.modules.clear(),
    moduleDatabase.topics.clear(),
    moduleDatabase.materials.clear(),
    moduleDatabase.storedFiles.clear(),
  ]);
  await moduleDatabase.modules.add(moduleRecord);
  await moduleDatabase.topics.add(topicRecord);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("MaterialViewerPage", () => {
  it("shows a loading state while the local material record is being fetched", async () => {
    const material = createMaterial("slow", "slow.txt", { content: "ready" });
    await saveMaterial(material, "ready");
    let resolveMaterial: ((value: MaterialRecord | undefined) => void) | undefined;
    vi.spyOn(materialService, "getById").mockReturnValueOnce(
      new Promise((resolve) => {
        resolveMaterial = resolve;
      }),
    );

    renderViewer(material.id);
    expect(screen.getByRole("status")).toHaveAccessibleName("Loading material");

    resolveMaterial?.(material);
    expect(await screen.findByRole("heading", { name: "slow" })).toBeInTheDocument();
    expect(await screen.findByText("ready")).toBeInTheDocument();
  });

  it("displays imported HTML as plain text and never creates live markup", async () => {
    const html = "<script>window.compromised = true</script><h2>Course text</h2>";
    const material = createMaterial("html", "lesson.html", {
      content: html,
      mimeType: "text/html",
    });
    await saveMaterial(material, html);

    renderViewer(material.id);

    const preview = await screen.findByRole("region", { name: "Text preview for lesson.html" });
    const pre = preview.querySelector("pre");
    expect(pre).not.toBeNull();
    if (!pre) throw new Error("The plain-text preview did not render its preformatted text.");
    expect(pre).toHaveTextContent(html);
    expect(pre.querySelector("script, h2")).toBeNull();
    expect(window).not.toHaveProperty("compromised");
  });

  it("shows PDF loading and reports malformed local PDF bytes", async () => {
    const material = createMaterial("broken-pdf", "broken.pdf", {
      content: "not a PDF",
      mimeType: "application/pdf",
    });
    await saveMaterial(material, "not a PDF");
    let rejectPdf: ((error: Error) => void) | undefined;
    vi.mocked(openPdf).mockReturnValueOnce({
      promise: new Promise((_resolve, reject) => {
        rejectPdf = reject;
      }),
      destroy: vi.fn(async () => undefined),
    });

    renderViewer(material.id);
    expect(await screen.findByText("Loading PDF…")).toBeInTheDocument();
    await waitFor(() => expect(openPdf).toHaveBeenCalledOnce());
    rejectPdf?.(new Error("Invalid PDF structure"));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This PDF could not be opened: Invalid PDF structure",
    );
  });

  it("destroys PDF resources when the viewer unmounts", async () => {
    const material = createMaterial("valid-pdf", "valid.pdf", {
      content: "%PDF-test",
      mimeType: "application/pdf",
    });
    await saveMaterial(material, "%PDF-test");
    const destroy = vi.fn(async () => undefined);
    vi.mocked(openPdf).mockReturnValueOnce({
      promise: Promise.resolve({
        numPages: 1,
        getPage: () => new Promise<never>(() => {}),
      } satisfies PdfDocument),
      destroy,
    });
    const { unmount } = renderViewer(material.id);

    expect(await screen.findByRole("region", { name: "PDF viewer for valid.pdf" })).toBeInTheDocument();
    const searchInput = screen.getByRole("searchbox", { name: "Search PDF text" });
    expect(searchInput).toHaveAttribute("id", "pdf-search");
    expect(screen.getByText("Find in PDF").closest("label")).toHaveAttribute("for", "pdf-search");
    expect(screen.getByRole("button", { name: "Next PDF search result" }).closest("label")).toBeNull();
    unmount();
    await waitFor(() => expect(destroy).toHaveBeenCalledOnce());
  });

  it("shows metadata and downloads unsupported originals, then revokes the URL", async () => {
    const material = createMaterial("doc", "handout.docx", {
      content: "original bytes",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      sizeBytes: 1536,
    });
    await saveMaterial(material, "original bytes");
    const createObjectURL = vi.fn(() => "blob:local-original");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });

    const { unmount } = renderViewer(material.id);

    expect(await screen.findByRole("alert")).toHaveTextContent(/preview could not be opened/i);
    expect(screen.getByText("handout.docx")).toBeInTheDocument();
    expect(screen.getByText(material.mimeType)).toBeInTheDocument();
    expect(screen.getByText("1.5 KB")).toBeInTheDocument();
    const download = await screen.findByRole("link", { name: "Download original" });
    expect(download).toHaveAttribute("href", "blob:local-original");
    expect(download).toHaveAttribute("download", "handout.docx");

    unmount();
    await waitFor(() => expect(revokeObjectURL).toHaveBeenCalledWith("blob:local-original"));
  });

  it("revokes the previous image object URL when switching files", async () => {
    const first = createMaterial("image-one", "first.png", {
      content: "image one",
      mimeType: "image/png",
    });
    const second = createMaterial("image-two", "second.png", {
      content: "image two",
      mimeType: "image/png",
    });
    const createObjectURL = vi
      .fn()
      .mockReturnValueOnce("blob:image-one")
      .mockReturnValueOnce("blob:image-two");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    const { rerender, unmount } = render(
      <MaterialFileViewer bytes={new ArrayBuffer(1)} material={first} />,
    );
    expect(await screen.findByRole("img", { name: "first.png" })).toHaveAttribute(
      "src",
      "blob:image-one",
    );

    rerender(
      <MaterialFileViewer bytes={new ArrayBuffer(2)} material={second} />,
    );
    expect(await screen.findByRole("img", { name: "second.png" })).toHaveAttribute(
      "src",
      "blob:image-two",
    );
    await waitFor(() => expect(revokeObjectURL).toHaveBeenCalledWith("blob:image-one"));

    unmount();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:image-two");
  });

  it("switches between materials in a topic and records the newly opened time", async () => {
    const first = createMaterial("first", "first.txt", {
      content: "first content",
      topic: true,
    });
    const second = createMaterial("second", "second.txt", {
      content: "second content",
      topic: true,
    });
    await saveMaterial(first, "first content");
    await saveMaterial(second, "second content");

    renderViewer(first.id);

    expect(await screen.findByRole("heading", { name: "first" })).toBeInTheDocument();
    expect(screen.getByText("1 of 2 in topic")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next material in topic" }));

    expect(await screen.findByRole("heading", { name: "second" })).toBeInTheDocument();
    expect(await screen.findByText("second content")).toBeInTheDocument();
    await waitFor(async () => {
      expect((await moduleDatabase.materials.get("second"))?.lastOpenedAt).toBeTruthy();
    });
  });
});
