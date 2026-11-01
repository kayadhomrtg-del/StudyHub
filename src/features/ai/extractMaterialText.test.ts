import JSZip from "jszip";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PdfDocument } from "../materials/pdfLoader";
import { openPdf } from "../materials/pdfLoader";
import { extractMaterialText } from "./extractMaterialText";

vi.mock("../materials/pdfLoader", () => ({
  openPdf: vi.fn(),
}));

const pdfOpen = vi.mocked(openPdf);

beforeEach(() => {
  pdfOpen.mockReset();
});

function material(
  originalFileName: string,
  extension: string,
  mimeType: string,
) {
  return { originalFileName, extension, mimeType };
}

function bytesOf(text: string): ArrayBuffer {
  return new TextEncoder().encode(text).buffer as ArrayBuffer;
}

async function zipOf(files: Record<string, string>): Promise<ArrayBuffer> {
  const zip = new JSZip();
  for (const [path, content] of Object.entries(files)) {
    zip.file(path, content);
  }
  return zip.generateAsync({ type: "arraybuffer" });
}

async function workbookOf(): Promise<ArrayBuffer> {
  return zipOf({
    "xl/workbook.xml":
      '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Course" sheetId="1" r:id="rId1"/></sheets></workbook>',
    "xl/_rels/workbook.xml.rels":
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Target="worksheets/sheet1.xml" Type="worksheet"/></Relationships>',
    "xl/worksheets/sheet1.xml":
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Topic</t></is></c><c r="B1"><v>Week 1</v></c></row></sheetData></worksheet>',
  });
}

describe("extractMaterialText", () => {
  it("reads UTF-8 text locally and leaves the text unchanged", async () => {
    const result = await extractMaterialText(
      material("notes.txt", "txt", "text/plain"),
      bytesOf("Chapter one.\n\nChapter two."),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.kind).toBe("text");
    expect(result.value.text).toBe("Chapter one.\n\nChapter two.");
    expect(result.value.truncated).toBe(false);
  });

  it("rejects unsupported file types and invalid UTF-8", async () => {
    const unsupported = await extractMaterialText(
      material("diagram.png", "png", "image/png"),
      bytesOf("not really an image"),
    );
    expect(unsupported.ok).toBe(false);

    const invalid = await extractMaterialText(
      material("notes.txt", "txt", "text/plain"),
      new Uint8Array([0xff, 0xfe, 0xfd]).buffer,
    );
    expect(invalid.ok).toBe(false);
  });

  it("caps extracted text deterministically", async () => {
    const result = await extractMaterialText(
      material("notes.txt", "txt", "text/plain"),
      bytesOf("abcdefghij"),
      { maxCharacters: 5 },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.text).toBe("abcde");
    expect(result.value.truncated).toBe(true);
    expect(result.value.notes.join(" ")).toContain("limited to 5 characters");
  });

  it("reads DOCX paragraphs without rendering untrusted HTML", async () => {
    const result = await extractMaterialText(
      material("lecture.docx", "docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
      await zipOf({
        "word/document.xml":
          '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>First paragraph.</w:t></w:r></w:p><w:p><w:r><w:t>Second paragraph.</w:t></w:r></w:p></w:body></w:document>',
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.kind).toBe("docx");
    expect(result.value.text).toBe("First paragraph.\nSecond paragraph.");
  });

  it("reads PPTX slide text in slide-number order", async () => {
    const result = await extractMaterialText(
      material("slides.pptx", "pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation"),
      await zipOf({
        "ppt/slides/slide10.xml":
          '<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>Slide ten.</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>',
        "ppt/slides/slide1.xml":
          '<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>Slide one.</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>',
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.text.indexOf("Slide one.")).toBeLessThan(
      result.value.text.indexOf("Slide ten."),
    );
    expect(result.value.text).toContain("Slide 1");
    expect(result.value.text).toContain("Slide 10");
  });

  it("reads worksheet names and cells through the existing parser", async () => {
    const result = await extractMaterialText(
      material("grades.xlsx", "xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
      await workbookOf(),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.kind).toBe("spreadsheet");
    expect(result.value.text).toBe("Sheet: Course\nTopic\tWeek 1");
  });

  it("reads PDF text through the existing local PDF loader and destroys it", async () => {
    const destroy = vi.fn(async () => {});
    pdfOpen.mockReturnValue({
      promise: Promise.resolve({
        numPages: 2,
        getPage: async (pageNumber: number) => ({
          getTextContent: async () => ({
            items: [{ str: `Page ${pageNumber} text.` }],
          }),
        }),
      } as unknown as PdfDocument),
      destroy,
    });

    const result = await extractMaterialText(
      material("reader.pdf", "pdf", "application/pdf"),
      new ArrayBuffer(0),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.text).toBe("Page 1 text.\n\nPage 2 text.");
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it("rejects malformed ZIP-based files through the existing safety check", async () => {
    const result = await extractMaterialText(
      material("broken.docx", "docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
      bytesOf("not a zip archive"),
    );

    expect(result.ok).toBe(false);
  });
});
