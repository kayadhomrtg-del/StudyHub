import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { openPdf, type PdfDocument } from "./pdfLoader";
import { PdfViewer } from "./PdfViewer";

vi.mock("./pdfLoader", () => ({
  openPdf: vi.fn(),
}));

function fakeDocument(pageTexts: string[], searchFailure?: Error): PdfDocument {
  const document = {
    numPages: pageTexts.length,
    getPage: vi.fn(async (pageNumber: number) => ({
      getTextContent: async () => {
        if (searchFailure) throw searchFailure;
        return { items: [{ str: pageTexts[pageNumber - 1] ?? "" }] };
      },
      getViewport: ({ scale }: { scale: number }) => ({ width: 600 * scale, height: 800 * scale }),
      render: () => ({ promise: Promise.resolve(), cancel: vi.fn() }),
    })),
  };
  return document as unknown as PdfDocument;
}

function mockPdf(pageTexts: string[], searchFailure?: Error) {
  const destroy = vi.fn(async () => undefined);
  vi.mocked(openPdf).mockReturnValue({
    promise: Promise.resolve(fakeDocument(pageTexts, searchFailure)),
    destroy,
  });
  return destroy;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("PdfViewer", () => {
  it("searches local page text and navigates between matching pages", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockImplementation(() => ({}) as CanvasRenderingContext2D);
    mockPdf(["Needle needle", "A needle here"]);
    render(<PdfViewer bytes={new ArrayBuffer(8)} fileName="notes.pdf" />);

    const search = await screen.findByRole("searchbox", { name: "Search PDF text" });
    fireEvent.change(search, { target: { value: "needle" } });
    expect(await screen.findByText("3 matches on 2 pages")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next PDF search result" }));
    expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Previous PDF page" }));
    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
  });

  it("reports local text extraction failures without losing the viewer controls", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockImplementation(() => ({}) as CanvasRenderingContext2D);
    mockPdf(["unreadable"], new Error("text extraction failed"));
    render(<PdfViewer bytes={new ArrayBuffer(8)} fileName="notes.pdf" />);

    fireEvent.change(await screen.findByRole("searchbox", { name: "Search PDF text" }), {
      target: { value: "notes" },
    });
    expect(await screen.findByText("PDF text search failed: text extraction failed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous PDF page" })).toBeInTheDocument();
  });
});
