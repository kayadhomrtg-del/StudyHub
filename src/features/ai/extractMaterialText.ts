/**
 * Local text extraction for the summary flow.
 *
 * Everything here reads bytes already held by the viewer. Nothing in this
 * module calls `fetch` or contacts the AI proxy. PDF.js may load its own
 * same-origin worker asset while reading a PDF; that is a local library
 * asset, not an AI or provider request.
 */

import JSZip from "jszip";
import { inspectZipArchive } from "../archive/zipSafety";
import type { MaterialRecord } from "../materials/material";
import { openPdf } from "../materials/pdfLoader";
import { parseSpreadsheet } from "../materials/SpreadsheetParser";
import {
  getMaterialTextDescriptor,
  getMaterialTextKind,
  MATERIAL_TEXT_MAX_CHARACTERS,
  MATERIAL_TEXT_MAX_PDF_PAGES,
  type MaterialTextKind,
} from "./materialTextSupport";

export interface ExtractMaterialTextOptions {
  maxCharacters?: number;
  maxPdfPages?: number;
}

export interface ExtractedMaterialText {
  kind: MaterialTextKind;
  text: string;
  characterCount: number;
  truncated: boolean;
  notes: string[];
}

export type ExtractMaterialTextResult =
  | { ok: true; value: ExtractedMaterialText }
  | { ok: false; message: string };

function isTooLarge(
  bytes: ArrayBuffer,
  kind: MaterialTextKind,
): string | null {
  const descriptor = getMaterialTextDescriptor(kind);
  if (bytes.byteLength <= descriptor.maxFileBytes) {
    return null;
  }
  return `This ${descriptor.label} is ${bytes.byteLength} bytes, which exceeds the ${descriptor.maxFileBytes}-byte local extraction limit.`;
}

function parseXml(xml: string, description: string): Document {
  const document = new DOMParser().parseFromString(xml, "application/xml");
  if (document.querySelector("parsererror")) {
    throw new Error(`The ${description} contains invalid XML.`);
  }
  return document;
}

function elements(parent: Document | Element, localName: string): Element[] {
  return Array.from(parent.getElementsByTagNameNS("*", localName));
}

function textOf(parent: Document | Element, localName: string): string {
  return elements(parent, localName)
    .map((element) => element.textContent ?? "")
    .join("");
}

function limitText(
  text: string,
  maxCharacters: number,
): { text: string; truncated: boolean } {
  if (text.length <= maxCharacters) {
    return { text, truncated: false };
  }
  return { text: text.slice(0, maxCharacters), truncated: true };
}

function finish(
  kind: MaterialTextKind,
  rawText: string,
  notes: string[],
  maxCharacters: number,
): ExtractMaterialTextResult {
  const limited = limitText(rawText, maxCharacters);
  if (limited.truncated) {
    notes.push(
      `The extracted text was limited to ${maxCharacters} characters.`,
    );
  }

  const text = limited.text.trim();
  return {
    ok: true,
    value: {
      kind,
      text,
      characterCount: text.length,
      truncated: limited.truncated,
      notes,
    },
  };
}

async function extractDocx(
  bytes: ArrayBuffer,
  maxCharacters: number,
): Promise<ExtractMaterialTextResult> {
  inspectZipArchive(bytes, {
    maxEntries: 10_000,
    maxExpandedBytes: 200 * 1024 * 1024,
  });
  const archive = await JSZip.loadAsync(bytes, { checkCRC32: true });
  const documentFile = archive.file("word/document.xml");
  if (!documentFile) {
    throw new Error("This Word document is missing its main document part.");
  }

  const document = parseXml(await documentFile.async("text"), "Word document");
  const paragraphs = elements(document, "p")
    .map((paragraph) => textOf(paragraph, "t").trim())
    .filter(Boolean);
  const text = paragraphs.length > 0
    ? paragraphs.join("\n")
    : elements(document, "t")
      .map((element) => element.textContent ?? "")
      .join("\n");

  return finish("docx", text, [], maxCharacters);
}

async function extractPptx(
  bytes: ArrayBuffer,
  maxCharacters: number,
): Promise<ExtractMaterialTextResult> {
  inspectZipArchive(bytes, {
    maxEntries: 10_000,
    maxExpandedBytes: 200 * 1024 * 1024,
  });
  const archive = await JSZip.loadAsync(bytes, { checkCRC32: true });
  const slides = Object.keys(archive.files)
    .map((path) => ({
      path,
      match: /^ppt\/slides\/slide(\d+)\.xml$/.exec(path),
    }))
    .filter(
      (entry): entry is { path: string; match: RegExpExecArray } =>
        entry.match !== null,
    )
    .sort((left, right) => Number(left.match[1]) - Number(right.match[1]));

  const parts: string[] = [];
  for (const slide of slides) {
    const file = archive.file(slide.path);
    if (!file) continue;
    const document = parseXml(await file.async("text"), `slide ${slide.match[1]}`);
    const paragraphs = elements(document, "p")
      .map((paragraph) => textOf(paragraph, "t").trim())
      .filter(Boolean);
    if (paragraphs.length > 0) {
      parts.push(`Slide ${slide.match[1]}\n${paragraphs.join("\n")}`);
    }
  }

  return finish("pptx", parts.join("\n\n"), [], maxCharacters);
}

async function extractSpreadsheet(
  bytes: ArrayBuffer,
  maxCharacters: number,
): Promise<ExtractMaterialTextResult> {
  const sheets = await parseSpreadsheet(bytes);
  const notes: string[] = [];
  const parts = sheets.map((sheet) => {
    if (sheet.truncated) {
      notes.push(
        `Worksheet “${sheet.name}” was limited to the first 500 rows and 40 columns.`,
      );
    }
    const rows = sheet.rows
      .map((row) =>
        row
          .map((cell) => cell.replace(/\s+/g, " ").trim())
          .join("\t")
          .trimEnd(),
      )
      .filter((row) => row.trim() !== "");
    return `Sheet: ${sheet.name}\n${rows.join("\n")}`;
  });

  return finish("spreadsheet", parts.join("\n\n"), notes, maxCharacters);
}

async function extractPdf(
  bytes: ArrayBuffer,
  maxCharacters: number,
  maxPdfPages: number,
): Promise<ExtractMaterialTextResult> {
  const loadingTask = openPdf(bytes);
  const notes: string[] = [];
  try {
    const document = await loadingTask.promise;
    const pagesToRead = Math.min(document.numPages, maxPdfPages);
    if (document.numPages > pagesToRead) {
      notes.push(
        `Only the first ${pagesToRead} PDF pages were read.`,
      );
    }

    const pages: string[] = [];
    let characterCount = 0;
    for (let pageNumber = 1; pageNumber <= pagesToRead; pageNumber += 1) {
      if (characterCount >= maxCharacters) break;
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const pageText = content.items
        .flatMap((item) => ("str" in item ? [item.str] : []))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (!pageText) continue;

      const addition = `${pageText}\n`;
      const remaining = maxCharacters - characterCount;
      if (addition.length > remaining) {
        pages.push(addition.slice(0, remaining));
        characterCount = maxCharacters;
        break;
      }
      pages.push(addition);
      characterCount += addition.length;
    }

    if (pages.length === 0) {
      notes.push(
        "No extractable text was found in this PDF. It may be a scanned document.",
      );
    }

    return finish("pdf", pages.join("\n").trim(), notes, maxCharacters);
  } finally {
    await loadingTask.destroy();
  }
}

/** Extracts local text from a material's in-memory bytes. */
export async function extractMaterialText(
  material: Pick<MaterialRecord, "originalFileName" | "extension" | "mimeType">,
  bytes: ArrayBuffer,
  options: ExtractMaterialTextOptions = {},
): Promise<ExtractMaterialTextResult> {
  const kind = getMaterialTextKind(material);
  if (!kind) {
    return {
      ok: false,
      message:
        "This file type cannot be read locally for a summary. Choose a text, PDF, Word, PowerPoint, or spreadsheet file.",
    };
  }

  const tooLarge = isTooLarge(bytes, kind);
  if (tooLarge) {
    return { ok: false, message: tooLarge };
  }

  const maxCharacters = options.maxCharacters ?? MATERIAL_TEXT_MAX_CHARACTERS;
  if (!Number.isInteger(maxCharacters) || maxCharacters <= 0) {
    return { ok: false, message: "The local extraction character limit is invalid." };
  }

  try {
    switch (kind) {
      case "text": {
        let text: string;
        try {
          text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
        } catch {
          return {
            ok: false,
            message:
              "This text file is not valid UTF-8 and cannot be read locally for a summary.",
          };
        }
        return finish(kind, text, [], maxCharacters);
      }
      case "pdf":
        return await extractPdf(
          bytes,
          maxCharacters,
          options.maxPdfPages ?? MATERIAL_TEXT_MAX_PDF_PAGES,
        );
      case "docx":
        return await extractDocx(bytes, maxCharacters);
      case "pptx":
        return await extractPptx(bytes, maxCharacters);
      case "spreadsheet":
        return await extractSpreadsheet(bytes, maxCharacters);
    }
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? `${material.originalFileName}: ${error.message}`
          : `${material.originalFileName}: this file could not be read locally.`,
    };
  }
}
