import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { loadPresentation } from "pptx-viewer";
import { OfficePreview } from "./OfficePreview";
import { parseSpreadsheet } from "./SpreadsheetParser";
import type { MaterialRecord } from "./material";

const baseMaterial: MaterialRecord = {
  id: "preview-test",
  title: "Preview test",
  originalFileName: "example.md",
  mimeType: "text/markdown",
  extension: "md",
  sizeBytes: 24,
  tags: [],
  status: "not-started",
  isFavorite: false,
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
};

function bytes(text: string): ArrayBuffer {
  return new TextEncoder().encode(text).buffer;
}

async function createXlsx(): Promise<ArrayBuffer> {
  const zip = new JSZip();
  zip.file("xl/workbook.xml", `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Class" sheetId="1" r:id="rId1"/></sheets></workbook>`);
  zip.file("xl/_rels/workbook.xml.rels", `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Target="worksheets/sheet1.xml" Type="worksheet"/></Relationships>`);
  zip.file("xl/worksheets/sheet1.xml", `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Week</t></is></c></row></sheetData></worksheet>`);
  return zip.generateAsync({ type: "arraybuffer" });
}

async function createDocx(): Promise<ArrayBuffer> {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`);
  zip.file("_rels/.rels", `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
  zip.file("word/document.xml", `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Local Word content</w:t></w:r></w:p><w:sectPr/></w:body></w:document>`);
  return zip.generateAsync({ type: "arraybuffer" });
}

async function createPptx(): Promise<ArrayBuffer> {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/></Types>`);
  zip.file("ppt/presentation.xml", `<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:sldIdLst><p:sldId id="256" r:id="rId1"/></p:sldIdLst><p:sldSz cx="9144000" cy="5143500"/></p:presentation>`);
  zip.file("ppt/_rels/presentation.xml.rels", `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/></Relationships>`);
  zip.file("ppt/slides/slide1.xml", `<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr/><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></a:xfrm></p:grpSpPr><p:sp><p:nvSpPr><p:cNvPr id="2" name="TextBox 1"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="9144000" cy="5143500"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US"/><a:t>Slide one</a:t></a:r><a:endParaRPr lang="en-US"/></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`);
  return zip.generateAsync({ type: "arraybuffer" });
}

describe("OfficePreview", () => {
  it("renders Markdown formatting while keeping embedded HTML inert", async () => {
    const { container } = render(
      <OfficePreview
        bytes={bytes("# Course notes\n\n**Important**\n\n<script>window.intruded=true</script>")}
        material={baseMaterial}
      />,
    );

    expect(await screen.findByRole("heading", { name: "Course notes" })).toBeInTheDocument();
    expect(screen.getByText("Important").tagName).toBe("STRONG");
    expect(container.querySelector("script")).toBeNull();
    expect(screen.getByRole("searchbox", { name: /find in document/i })).toBeInTheDocument();
  });

  it("shows readable source code with syntax highlighting", async () => {
    const { container } = render(
      <OfficePreview
        bytes={bytes("const answer: number = 42;")}
        material={{ ...baseMaterial, extension: "ts", originalFileName: "example.ts" }}
      />,
    );

    expect(await screen.findByText("const answer: number = 42;")).toBeInTheDocument();
    await waitFor(() => expect(container.querySelector("code.hljs .hljs-keyword")).toHaveTextContent("const"));
    expect(await screen.findByRole("searchbox", { name: /find in document/i })).toBeInTheDocument();
  });

  it("reports corrupt DOCX input instead of pretending to preview it", async () => {
    render(
      <OfficePreview
        bytes={bytes("not a docx")}
        material={{ ...baseMaterial, extension: "docx", originalFileName: "broken.docx" }}
      />,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(/preview could not be opened/i);
  });

  it("renders valid local DOCX content inside a script-isolated preview", async () => {
    render(
      <OfficePreview
        bytes={await createDocx()}
        material={{ ...baseMaterial, extension: "docx", originalFileName: "notes.docx" }}
      />,
    );

    const frame = await screen.findByTitle("notes.docx document preview");
    expect(frame).toHaveAttribute("sandbox", "");
    expect(frame).toHaveAttribute("srcdoc", expect.stringContaining("Local Word content"));
  });

  it("parses and displays local XLSX worksheet data", async () => {
    const workbookBytes = await createXlsx();
    await expect(parseSpreadsheet(workbookBytes)).resolves.toMatchObject([
      { name: "Class", rows: [["Week"]] },
    ]);
    render(
      <OfficePreview
        bytes={workbookBytes}
        material={{ ...baseMaterial, extension: "xlsx", originalFileName: "class.xlsx" }}
      />,
    );
    expect(await screen.findByRole("table")).toBeInTheDocument();
    expect(screen.getByText("Week")).toBeInTheDocument();
  });

  it("parses presentation slides locally for rendering and navigation", async () => {
    const pptx = await createPptx();
    const presentation = await loadPresentation(pptx);
    expect(presentation.slides).toHaveLength(1);
    expect(presentation.slides[0]?.elements.some((element) =>
      element.type === "text" || ("text" in element && element.text?.paragraphs.some((paragraph) =>
        paragraph.runs.some((run) => run.text === "Slide one"),
      )),
    )).toBe(true);
    presentation.cleanup();

    render(
      <OfficePreview
        bytes={pptx}
        material={{ ...baseMaterial, extension: "pptx", originalFileName: "lecture.pptx" }}
      />,
    );
    expect(await screen.findByText("Slide 1 of 1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next slide" })).toBeDisabled();
    const preview = screen.getByRole("region", { name: "Presentation preview" });
    await waitFor(() => expect(preview.querySelector("svg")).not.toBeNull());
  });
});
