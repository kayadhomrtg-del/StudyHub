import { useEffect, useMemo, useRef, useState } from "react";
import type { LoadedPresentation } from "pptx-viewer";
import { lazy, Suspense } from "react";
import { ErrorState, LoadingState } from "../../components/ui/StatePanel";
import { inspectZipArchive } from "../archive/zipSafety";
import type { MaterialRecord } from "./material";
import type { SpreadsheetSheet } from "./SpreadsheetParser";

interface OfficePreviewProps {
  material: MaterialRecord;
  bytes: ArrayBuffer;
}

interface PreviewData {
  html?: string;
  text?: string;
  slides?: LoadedPresentation;
  sheets?: SpreadsheetSheet[];
}

const maxPreviewCharacters = 2_000_000;
const maxOfficeFileBytes = 100 * 1024 * 1024;
const maxTextFileBytes = 8 * 1024 * 1024;
const MarkdownPreviewContent = lazy(() =>
  import("./MarkdownPreviewContent").then((module) => ({ default: module.MarkdownPreviewContent })),
);
const codeLanguages: Record<string, string> = {
  c: "c",
  cc: "cpp",
  cpp: "cpp",
  css: "css",
  h: "c",
  hpp: "cpp",
  html: "xml",
  htm: "xml",
  js: "javascript",
  jsx: "javascript",
  json: "json",
  md: "markdown",
  py: "python",
  sql: "sql",
  ts: "typescript",
  tsx: "typescript",
  xml: "xml",
};

function searchCount(content: string | undefined, query: string): number {
  if (!content || !query.trim()) return 0;
  return content.toLocaleLowerCase().split(query.trim().toLocaleLowerCase()).length - 1;
}

function TextSearch({ content }: { content: string }) {
  const [query, setQuery] = useState("");
  const count = searchCount(content, query);
  return (
    <label className="flex items-center gap-2 border-b border-line px-3 py-2 text-[11px] text-muted">
      <span>Find in document</span>
      <input
        className="min-w-0 flex-1 rounded-lg border border-line bg-canvas px-2.5 py-1.5 text-ink"
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search document text"
        type="search"
        value={query}
      />
      <span aria-live="polite" className="min-w-20 text-right">
        {query ? `${count} match${count === 1 ? "" : "es"}` : ""}
      </span>
    </label>
  );
}

function SpreadsheetPreview({ sheets }: { sheets: SpreadsheetSheet[] }) {
  const [activeSheet, setActiveSheet] = useState(0);
  const sheet = sheets[activeSheet];
  const fullText = sheets
    .flatMap((item) => item.rows.flat())
    .filter(Boolean)
    .join("\n");
  const columns = Math.max(1, ...sheet.rows.map((row) => row.length));
  return (
    <section aria-label="Spreadsheet preview" className="overflow-hidden rounded-2xl border border-line bg-surface shadow-panel">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
        <label className="text-[11px] text-muted" htmlFor="xlsx-sheet">Worksheet</label>
        <select
          className="rounded-lg border border-line bg-canvas px-3 py-2 text-[11px] text-ink"
          id="xlsx-sheet"
          onChange={(event) => setActiveSheet(Number(event.target.value))}
          value={activeSheet}
        >
          {sheets.map((item, index) => <option key={`${item.name}-${index}`} value={index}>{item.name}</option>)}
        </select>
        <span className="ml-auto text-[10px] text-muted">
          Showing up to 500 rows and 40 columns per sheet
        </span>
      </div>
      <TextSearch content={fullText} />
      <div className="max-h-[70vh] overflow-auto">
        <table className="min-w-full border-collapse text-left text-[11px]">
          <tbody>
            {sheet.rows.map((row, rowIndex) => (
              <tr className={rowIndex === 0 ? "bg-subtle font-semibold text-ink" : "text-ink"} key={rowIndex}>
                {Array.from({ length: columns }, (_, columnIndex) => (
                  <td className="max-w-72 whitespace-pre-wrap break-words border-b border-r border-line px-3 py-2 align-top" key={columnIndex}>
                    {row[columnIndex] ?? ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {sheet.truncated && <p className="p-3 text-[11px] text-muted">This worksheet is large. The preview is limited to its first 500 rows and 40 columns.</p>}
      </div>
    </section>
  );
}

function SlidePreview({ presentation }: { presentation: LoadedPresentation }) {
  const container = useRef<HTMLDivElement>(null);
  const [slideIndex, setSlideIndex] = useState(0);
  const slides = presentation.slides;
  const slideText = slides.flatMap((slide) => slide.elements.flatMap((element) => {
    if (element.type === "text") {
      return element.text.paragraphs.map((paragraph) => paragraph.runs.map((run) => run.text).join(""));
    }
    if (element.type === "table") {
      return element.rows.flatMap((row) => row.cells.map((cell) =>
        (cell.text?.paragraphs ?? []).map((paragraph) => paragraph.runs.map((run) => run.text).join("")).join("\n"),
      ));
    }
    return [];
  })).join("\n");
  useEffect(() => {
    let active = true;
    void import("pptx-viewer").then(({ renderSlideToElement }) => {
      if (!active || !container.current) return;
      container.current.replaceChildren();
      renderSlideToElement(presentation, slideIndex, container.current, { width: 1000 });
    }).catch(() => {
      if (active && container.current) container.current.textContent = "This slide could not be rendered.";
    });
    return () => { active = false; };
  }, [presentation, slideIndex]);

  return (
    <section aria-label="Presentation preview" className="overflow-hidden rounded-2xl border border-line bg-surface shadow-panel">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <button
          className="rounded-lg border border-line px-3 py-1.5 text-[11px] text-ink disabled:opacity-40"
          disabled={slideIndex === 0}
          onClick={() => setSlideIndex((index) => Math.max(0, index - 1))}
          type="button"
        >Previous slide</button>
        <span aria-live="polite" className="text-[11px] text-muted">Slide {slideIndex + 1} of {slides.length}</span>
        <button
          className="rounded-lg border border-line px-3 py-1.5 text-[11px] text-ink disabled:opacity-40"
          disabled={slideIndex >= slides.length - 1}
          onClick={() => setSlideIndex((index) => Math.min(slides.length - 1, index + 1))}
          type="button"
        >Next slide</button>
      </div>
      <TextSearch content={slideText} />
      <div className="max-h-[75vh] overflow-auto bg-subtle p-3 sm:p-6">
        <div className="mx-auto w-full max-w-5xl overflow-hidden bg-white shadow-panel" ref={container} />
      </div>
    </section>
  );
}

export function OfficePreview({ material, bytes }: OfficePreviewProps) {
  const [preview, setPreview] = useState<PreviewData>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const extension = material.extension?.toLowerCase() ?? "";
  const previewRef = useRef<PreviewData | undefined>(undefined);

  useEffect(() => {
    let active = true;
    previewRef.current?.slides?.cleanup();
    previewRef.current = undefined;
    setPreview(undefined);
    setError("");
    setLoading(true);
    void (async () => {
      try {
        let result: PreviewData;
        if (extension === "docx") {
          if (bytes.byteLength > maxOfficeFileBytes) throw new Error("This Word document exceeds the 100 MiB preview limit.");
          inspectZipArchive(bytes, { maxEntries: 10_000, maxExpandedBytes: 200 * 1024 * 1024 });
          const [docx, purifierModule] = await Promise.all([
            import("docx-preview"),
            import("dompurify"),
          ]);
          const purifier = purifierModule.default;
          const body = document.createElement("div");
          const styles = document.createElement("div");
          await docx.renderAsync(bytes.slice(0), body, styles, {
            renderAltChunks: false,
            useBase64URL: true,
            renderChanges: false,
            renderComments: false,
          });
          const documentText = body.textContent ?? "";
          if (documentText.length > maxPreviewCharacters) {
            throw new Error("This document is too large to preview safely (maximum 2 million text characters).");
          }
          result = {
            html: `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; font-src data:; style-src 'unsafe-inline';"><style>${purifier.sanitize(styles.innerHTML, { ALLOWED_TAGS: ["style"], ALLOWED_ATTR: ["type"] })}</style></head><body>${purifier.sanitize(body.innerHTML, {
              ALLOWED_TAGS: ["a", "article", "b", "br", "div", "em", "h1", "h2", "h3", "h4", "h5", "h6", "img", "li", "ol", "p", "section", "span", "strong", "sub", "sup", "table", "tbody", "td", "th", "thead", "tr", "u", "ul"],
              ALLOWED_ATTR: ["alt", "class", "colspan", "height", "href", "rowspan", "src", "style", "title", "width"],
            })}</body></html>`,
            text: documentText,
          };
        } else if (extension === "pptx") {
          if (bytes.byteLength > maxOfficeFileBytes) throw new Error("This presentation exceeds the 100 MiB preview limit.");
          inspectZipArchive(bytes, { maxEntries: 10_000, maxExpandedBytes: 200 * 1024 * 1024 });
          const { loadPresentation } = await import("pptx-viewer");
          const slides = await loadPresentation(bytes.slice(0));
          if (slides.slides.length === 0) {
            slides.cleanup();
            throw new Error("This presentation does not contain any readable slides.");
          }
          result = { slides };
        } else if (extension === "xlsx" || extension === "xlsm") {
          if (bytes.byteLength > maxOfficeFileBytes) throw new Error("This workbook exceeds the 100 MiB preview limit.");
          const { parseSpreadsheet } = await import("./SpreadsheetParser");
          result = { sheets: await parseSpreadsheet(bytes.slice(0)) };
        } else {
          if (bytes.byteLength > maxTextFileBytes) throw new Error("This text file exceeds the 8 MiB preview limit.");
          const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
          if (text.length > maxPreviewCharacters) {
            throw new Error("This document is too large to preview safely (maximum 2 million characters).");
          }
          result = { text };
        }
        if (active) {
          previewRef.current = result;
          setPreview(result);
        }
        else result.slides?.cleanup();
      } catch (previewError) {
        if (active) {
          setError(previewError instanceof Error ? previewError.message : "This file could not be previewed.");
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
      previewRef.current?.slides?.cleanup();
      previewRef.current = undefined;
    };
  }, [bytes, extension]);

  const markdown = extension === "md" || extension === "markdown";
  const language = codeLanguages[extension];
  const plainText = useMemo(() => preview?.text, [preview?.text]);
  const highlighted = useMemo(() => {
    if (!plainText || !language || markdown) return "";
    const languageLoaders: Record<string, () => Promise<{ default: import("highlight.js").LanguageFn }>> = {
      c: () => import("highlight.js/lib/languages/c"),
      cpp: () => import("highlight.js/lib/languages/cpp"),
      css: () => import("highlight.js/lib/languages/css"),
      javascript: () => import("highlight.js/lib/languages/javascript"),
      json: () => import("highlight.js/lib/languages/json"),
      markdown: () => import("highlight.js/lib/languages/markdown"),
      python: () => import("highlight.js/lib/languages/python"),
      sql: () => import("highlight.js/lib/languages/sql"),
      typescript: () => import("highlight.js/lib/languages/typescript"),
      xml: () => import("highlight.js/lib/languages/xml"),
    };
    const loader = languageLoaders[language];
    if (!loader) return "";
    return import("highlight.js/lib/core").then(async ({ default: hljs }) => {
        const languageModule = await loader();
        hljs.registerLanguage(language, languageModule.default);
        return hljs.highlight(plainText, { language }).value;
      }).catch(() => "");
  }, [language, markdown, plainText]);
  const [highlightedHtml, setHighlightedHtml] = useState("");
  useEffect(() => {
    let active = true;
    if (highlighted) void highlighted.then((html) => { if (active) setHighlightedHtml(html); });
    else setHighlightedHtml("");
    return () => { active = false; };
  }, [highlighted]);

  if (loading) return <LoadingState label={`Loading ${extension.toUpperCase()} preview`} />;
  if (error) {
    return (
      <div className="space-y-3">
        <ErrorState message={`Preview could not be opened: ${error}`} />
      </div>
    );
  }
  if (preview?.slides) return <SlidePreview presentation={preview.slides} />;
  if (preview?.sheets) return <SpreadsheetPreview sheets={preview.sheets} />;
  if (preview?.html !== undefined) {
    return (
      <section aria-label={`Word document preview for ${material.originalFileName}`} className="overflow-hidden rounded-2xl border border-line bg-surface shadow-panel">
        {preview.text && <TextSearch content={preview.text} />}
        <iframe
          className="h-[75vh] min-h-96 w-full bg-white"
          sandbox=""
          srcDoc={preview.html}
          title={`${material.originalFileName} document preview`}
        />
      </section>
    );
  }
  if (plainText === undefined) return <ErrorState message="This file did not produce preview content." />;

  if (markdown) {
    return (
      <section aria-label={`Markdown preview for ${material.originalFileName}`} className="overflow-hidden rounded-2xl border border-line bg-surface shadow-panel">
        <TextSearch content={plainText} />
        <article className="prose prose-sm max-w-none overflow-auto p-5 text-ink sm:p-8">
          <Suspense fallback={<pre className="whitespace-pre-wrap font-mono text-[12px]">{plainText}</pre>}>
            <MarkdownPreviewContent source={plainText} />
          </Suspense>
        </article>
      </section>
    );
  }
  return (
    <section aria-label={`Text preview for ${material.originalFileName}`} className="overflow-hidden rounded-2xl border border-line bg-surface shadow-panel">
      <TextSearch content={plainText} />
      <pre className="max-h-[75vh] overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-[12px] leading-6 text-ink">
        {language && highlightedHtml
          ? <code className="hljs" dangerouslySetInnerHTML={{ __html: highlightedHtml }} />
          : <code>{plainText}</code>}
      </pre>
    </section>
  );
}
