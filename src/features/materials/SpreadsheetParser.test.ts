import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { parseSpreadsheet } from "./SpreadsheetParser";

async function createWorkbook() {
  const zip = new JSZip();
  zip.file("xl/workbook.xml", `<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Course" sheetId="1" r:id="rId1"/></sheets></workbook>`);
  zip.file("xl/_rels/workbook.xml.rels", `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Target="worksheets/sheet1.xml" Type="worksheet"/></Relationships>`);
  zip.file("xl/worksheets/sheet1.xml", `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Topic</t></is></c><c r="B1"><v>Week 1</v></c></row></sheetData></worksheet>`);
  return zip.generateAsync({ type: "arraybuffer" });
}

describe("parseSpreadsheet", () => {
  it("reads worksheet names and inline and numeric cells locally", async () => {
    await expect(parseSpreadsheet(await createWorkbook())).resolves.toEqual([
      { name: "Course", rows: [["Topic", "Week 1"]], truncated: false },
    ]);
  });

  it("rejects invalid workbook archives with a useful error", async () => {
    await expect(parseSpreadsheet(new TextEncoder().encode("not a workbook").buffer))
      .rejects.toThrow();
  });
});
