import type { MaterialRecord } from "../materials/material";

/**
 * The file types the local summary flow can read. The list mirrors the
 * existing material viewer so a file is never offered for summarisation
 * unless it already has a supported local reading path.
 */
export type MaterialTextKind = "text" | "pdf" | "docx" | "pptx" | "spreadsheet";

export const MATERIAL_TEXT_MAX_CHARACTERS = 2_000_000;
export const MATERIAL_TEXT_MAX_TEXT_FILE_BYTES = 8 * 1024 * 1024;
export const MATERIAL_TEXT_MAX_OFFICE_FILE_BYTES = 100 * 1024 * 1024;
export const MATERIAL_TEXT_MAX_PDF_FILE_BYTES = 100 * 1024 * 1024;
export const MATERIAL_TEXT_MAX_PDF_PAGES = 1_000;

const TEXT_EXTENSIONS = new Set([
  "txt", "md", "markdown", "cpp", "cc", "cxx", "h", "hpp", "c", "js", "jsx",
  "mjs", "cjs", "ts", "tsx", "html", "htm", "css", "json", "xml", "yaml",
  "yml", "py", "java", "cs", "go", "rs", "sql", "sh", "bash", "toml", "ini",
  "log", "csv", "properties", "php", "rb", "swift", "kt", "vue", "svelte",
]);

export interface MaterialTextDescriptor {
  kind: MaterialTextKind;
  label: string;
  maxFileBytes: number;
  maxCharacters: number;
}

const DESCRIPTORS: Record<MaterialTextKind, MaterialTextDescriptor> = {
  text: {
    kind: "text",
    label: "text",
    maxFileBytes: MATERIAL_TEXT_MAX_TEXT_FILE_BYTES,
    maxCharacters: MATERIAL_TEXT_MAX_CHARACTERS,
  },
  pdf: {
    kind: "pdf",
    label: "PDF",
    maxFileBytes: MATERIAL_TEXT_MAX_PDF_FILE_BYTES,
    maxCharacters: MATERIAL_TEXT_MAX_CHARACTERS,
  },
  docx: {
    kind: "docx",
    label: "Word document",
    maxFileBytes: MATERIAL_TEXT_MAX_OFFICE_FILE_BYTES,
    maxCharacters: MATERIAL_TEXT_MAX_CHARACTERS,
  },
  pptx: {
    kind: "pptx",
    label: "PowerPoint presentation",
    maxFileBytes: MATERIAL_TEXT_MAX_OFFICE_FILE_BYTES,
    maxCharacters: MATERIAL_TEXT_MAX_CHARACTERS,
  },
  spreadsheet: {
    kind: "spreadsheet",
    label: "spreadsheet",
    maxFileBytes: MATERIAL_TEXT_MAX_OFFICE_FILE_BYTES,
    maxCharacters: MATERIAL_TEXT_MAX_CHARACTERS,
  },
};

/** Returns the local text-extraction strategy for a material, if any. */
export function getMaterialTextKind(
  material: Pick<MaterialRecord, "extension" | "mimeType">,
): MaterialTextKind | null {
  const extension = (material.extension ?? "").toLowerCase();
  if (extension === "pdf" || material.mimeType === "application/pdf") {
    return "pdf";
  }
  if (extension === "docx") {
    return "docx";
  }
  if (extension === "pptx") {
    return "pptx";
  }
  if (extension === "xlsx" || extension === "xlsm") {
    return "spreadsheet";
  }
  if (
    TEXT_EXTENSIONS.has(extension) ||
    material.mimeType.startsWith("text/") ||
    material.mimeType === "application/json" ||
    material.mimeType === "application/xml"
  ) {
    return "text";
  }
  return null;
}

export function isMaterialTextSupported(
  material: Pick<MaterialRecord, "extension" | "mimeType">,
): boolean {
  return getMaterialTextKind(material) !== null;
}

export function getMaterialTextDescriptor(
  kind: MaterialTextKind,
): MaterialTextDescriptor {
  return DESCRIPTORS[kind];
}
