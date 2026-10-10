import JSZip from "jszip";
import { inspectZipArchive } from "../archive/zipSafety";

export interface SpreadsheetSheet {
  name: string;
  rows: string[][];
  truncated: boolean;
}

const MAX_SHEETS = 100;
const MAX_ROWS = 500;
const MAX_COLUMNS = 40;

function parseXml(xml: string, name: string): Document {
  const document = new DOMParser().parseFromString(xml, "application/xml");
  if (document.querySelector("parsererror")) {
    throw new Error(`The workbook contains invalid ${name} XML.`);
  }
  return document;
}

function elements(parent: Document | Element, localName: string): Element[] {
  return Array.from(parent.getElementsByTagNameNS("*", localName));
}

function resolvePackagePath(baseDirectory: string, target: string): string {
  const segments = `${baseDirectory}/${target}`.split("/");
  const resolved: string[] = [];
  for (const segment of segments) {
    if (!segment || segment === ".") continue;
    if (segment === "..") {
      if (resolved.length === 0) throw new Error("The workbook contains an invalid file reference.");
      resolved.pop();
    } else {
      resolved.push(segment);
    }
  }
  return resolved.join("/");
}

function columnIndex(reference: string): number | undefined {
  const letters = /^([A-Z]+)/i.exec(reference)?.[1]?.toUpperCase();
  if (!letters) return undefined;
  let index = 0;
  for (const letter of letters) index = index * 26 + letter.charCodeAt(0) - 64;
  return index - 1;
}

export async function parseSpreadsheet(bytes: ArrayBuffer): Promise<SpreadsheetSheet[]> {
  inspectZipArchive(bytes, { maxEntries: 10_000, maxExpandedBytes: 200 * 1024 * 1024 });
  const archive = await JSZip.loadAsync(bytes, { checkCRC32: true });
  const workbookFile = archive.file("xl/workbook.xml");
  const relationshipsFile = archive.file("xl/_rels/workbook.xml.rels");
  if (!workbookFile || !relationshipsFile) {
    throw new Error("This file is not a readable XLSX workbook.");
  }

  const [workbookXml, relationshipsXml] = await Promise.all([
    workbookFile.async("text"),
    relationshipsFile.async("text"),
  ]);
  const workbook = parseXml(workbookXml, "workbook");
  const relationships = parseXml(relationshipsXml, "relationship");
  const targets = new Map(
    elements(relationships, "Relationship").map((relationship) => [
      relationship.getAttribute("Id") ?? "",
      {
        target: relationship.getAttribute("Target") ?? "",
        external: relationship.getAttribute("TargetMode") === "External",
      },
    ]),
  );
  const sharedStrings: string[] = [];
  const sharedStringsFile = archive.file("xl/sharedStrings.xml");
  if (sharedStringsFile) {
    const sharedXml = parseXml(await sharedStringsFile.async("text"), "shared strings");
    for (const item of elements(sharedXml, "si")) {
      sharedStrings.push(elements(item, "t").map((text) => text.textContent ?? "").join(""));
    }
  }

  const sheets = elements(workbook, "sheet");
  if (sheets.length === 0) throw new Error("This workbook does not contain any worksheets.");
  if (sheets.length > MAX_SHEETS) {
    throw new Error(`This workbook has more than ${MAX_SHEETS} worksheets and cannot be previewed completely.`);
  }

  const parsedSheets: SpreadsheetSheet[] = [];
  for (const sheet of sheets) {
    const name = sheet.getAttribute("name") ?? "Sheet";
    const relationshipId =
      sheet.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id") ??
      sheet.getAttribute("r:id") ??
      "";
    const relationship = targets.get(relationshipId);
    if (!relationship || relationship.external || !relationship.target) {
      throw new Error(`The worksheet “${name}” has an invalid file reference.`);
    }
    const path = relationship.target.startsWith("/")
      ? resolvePackagePath("", relationship.target.slice(1))
      : resolvePackagePath("xl", relationship.target);
    const worksheetFile = archive.file(path);
    if (!worksheetFile) throw new Error(`The worksheet “${name}” is missing from the workbook.`);

    const worksheet = parseXml(await worksheetFile.async("text"), `worksheet “${name}”`);
    const worksheetRows = elements(worksheet, "row");
    const rows: string[][] = [];
    let truncated = worksheetRows.length > MAX_ROWS;
    for (const row of worksheetRows.slice(0, MAX_ROWS)) {
      const values: string[] = [];
      for (const cell of elements(row, "c")) {
        const index = columnIndex(cell.getAttribute("r") ?? "");
        if (index === undefined) continue;
        if (index >= MAX_COLUMNS) {
          truncated = true;
          continue;
        }
        const cellType = cell.getAttribute("t");
        let value: string;
        if (cellType === "inlineStr") {
          value = elements(cell, "t").map((text) => text.textContent ?? "").join("");
        } else {
          const rawValue = elements(cell, "v")[0]?.textContent ?? "";
          if (cellType === "s") {
            const stringIndex = Number(rawValue);
            const sharedString = sharedStrings[stringIndex];
            if (!Number.isInteger(stringIndex) || sharedString === undefined) {
              throw new Error(`The worksheet “${name}” references a missing shared string.`);
            }
            value = sharedString;
          } else if (cellType === "b") {
            value = rawValue === "1" ? "TRUE" : "FALSE";
          } else {
            value = rawValue;
          }
        }
        values[index] = value;
      }
      rows.push(values);
    }
    parsedSheets.push({ name, rows, truncated });
  }
  return parsedSheets;
}
