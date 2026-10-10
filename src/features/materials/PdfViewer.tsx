import { useEffect, useRef, useState } from "react";
import { openPdf, type PdfDocument } from "./pdfLoader";
import type { RenderTask } from "pdfjs-dist";

interface PdfViewerProps {
  bytes: ArrayBuffer;
  fileName: string;
}

export function PdfViewer({ bytes, fileName }: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const documentRef = useRef<PdfDocument | null>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [zoom, setZoom] = useState(100);
  const [fitWidth, setFitWidth] = useState(true);
  const [containerWidth, setContainerWidth] = useState(720);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rendering, setRendering] = useState(false);
  const [documentProxy, setDocumentProxy] = useState<PdfDocument | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMatches, setSearchMatches] = useState(0);
  const [searchMatchPages, setSearchMatchPages] = useState<number[]>([]);
  const [searchResultIndex, setSearchResultIndex] = useState(0);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setPageNumber(1);
    setPageCount(0);
    documentRef.current = null;
    setDocumentProxy(null);
    setSearchMatches(0);
    setSearchError("");

    const loadingTask = openPdf(bytes);
    void loadingTask.promise
      .then((document) => {
        if (!active) {
          void loadingTask.destroy();
          return;
        }
        documentRef.current = document;
        setDocumentProxy(document);
        setPageCount(document.numPages);
        setLoading(false);
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(
            loadError instanceof Error
              ? `This PDF could not be opened: ${loadError.message}`
              : "This PDF could not be opened. The file may be damaged.",
          );
          setLoading(false);
        }
      });

    return () => {
      active = false;
      renderTaskRef.current?.cancel();
      documentRef.current = null;
      void loadingTask.destroy();
    };
  }, [bytes]);

  useEffect(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    if (!documentProxy || !query) {
      setSearchMatches(0);
      setSearchMatchPages([]);
      setSearchResultIndex(0);
      setSearching(false);
      setSearchError("");
      return;
    }
    let active = true;
    setSearching(true);
    setSearchError("");
    void (async () => {
      try {
        let matchCount = 0;
        const pagesWithMatches: number[] = [];
        const pagesToSearch = Math.min(documentProxy.numPages, 1000);
        for (let pageNumber = 1; pageNumber <= pagesToSearch; pageNumber += 1) {
          const page = await documentProxy.getPage(pageNumber);
          const content = await page.getTextContent();
          const pageText = content.items
            .flatMap((item) => "str" in item ? [item.str] : [])
            .join(" ")
            .toLocaleLowerCase();
          const pageMatches = pageText.split(query).length - 1;
          matchCount += pageMatches;
          if (pageMatches > 0) pagesWithMatches.push(pageNumber);
        }
        if (active) {
          setSearchMatches(matchCount);
          setSearchMatchPages(pagesWithMatches);
          setSearchResultIndex(0);
        }
      } catch (searchFailure) {
        if (active) {
          setSearchError(
            searchFailure instanceof Error
              ? `PDF text search failed: ${searchFailure.message}`
              : "PDF text search failed.",
          );
        }
      } finally {
        if (active) setSearching(false);
      }
    })();
    return () => { active = false; };
  }, [documentProxy, searchQuery]);

  useEffect(() => {
    const updateWidth = () => {
      setContainerWidth(Math.max(320, (containerRef.current?.clientWidth ?? 752) - 32));
    };
    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  useEffect(() => {
    const document = documentRef.current;
    const canvas = canvasRef.current;
    if (!document || !canvas || loading || error) return;
    let active = true;
    setRendering(true);
    renderTaskRef.current?.cancel();

    void document
      .getPage(pageNumber)
      .then((page) => {
        if (!active) return;
        const initialViewport = page.getViewport({ scale: 1 });
        const scale = fitWidth
          ? Math.min(containerWidth / initialViewport.width, 2)
          : zoom / 100;
        const viewport = page.getViewport({ scale });
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas rendering is unavailable in this browser.");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const task = page.render({ canvasContext: context, viewport });
        renderTaskRef.current = task;
        return task.promise;
      })
      .then(() => {
        if (active) setRendering(false);
      })
      .catch((renderError: unknown) => {
        if (
          active &&
          !(renderError instanceof Error && renderError.name === "RenderingCancelledException")
        ) {
          setError(
            renderError instanceof Error
              ? `This PDF page could not be rendered: ${renderError.message}`
              : "This PDF page could not be rendered.",
          );
          setRendering(false);
        }
      });

    return () => {
      active = false;
      renderTaskRef.current?.cancel();
      renderTaskRef.current = null;
    };
  }, [containerWidth, error, fitWidth, loading, pageNumber, zoom]);

  return (
    <section
      aria-label={`PDF viewer for ${fileName}`}
      className="overflow-hidden rounded-2xl border border-line bg-surface shadow-panel"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2.5 sm:px-4">
        <div className="flex items-center gap-2">
          <button
            aria-label="Previous PDF page"
            className="rounded-lg border border-line px-2.5 py-1.5 text-[11px] text-ink hover:bg-subtle disabled:opacity-40"
            disabled={pageNumber <= 1 || loading || Boolean(error)}
            onClick={() => setPageNumber((page) => Math.max(1, page - 1))}
            type="button"
          >
            Previous
          </button>
          <span aria-live="polite" className="min-w-20 text-center text-[11px] text-muted">
            {pageCount ? `Page ${pageNumber} of ${pageCount}` : "Page —"}
          </span>
          <button
            aria-label="Next PDF page"
            className="rounded-lg border border-line px-2.5 py-1.5 text-[11px] text-ink hover:bg-subtle disabled:opacity-40"
            disabled={pageNumber >= pageCount || loading || Boolean(error)}
            onClick={() => setPageNumber((page) => Math.min(pageCount, page + 1))}
            type="button"
          >
            Next
          </button>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2 border-b border-line px-3 py-2 text-[11px] text-muted sm:px-4">
          <label htmlFor="pdf-search">Find in PDF</label>
          <input
            aria-label="Search PDF text"
            className="min-w-0 flex-1 rounded-lg border border-line bg-canvas px-2.5 py-1.5 text-ink"
            id="pdf-search"
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search document text"
            type="search"
            value={searchQuery}
          />
          <span aria-live="polite" className="min-w-24 text-right">
            {searching
              ? "Searching…"
              : searchError ||
                (searchQuery
                  ? `${searchMatches} matches on ${searchMatchPages.length} pages${documentProxy && documentProxy.numPages > 1000 ? " (first 1,000 pages)" : ""}`
                  : "")}
          </span>
          <button
            aria-label="Previous PDF search result"
            className="rounded-lg border border-line px-2 py-1.5 text-ink disabled:opacity-40"
            disabled={searching || searchMatchPages.length === 0}
            onClick={() => {
              const index = (searchResultIndex - 1 + searchMatchPages.length) % searchMatchPages.length;
              setSearchResultIndex(index);
              setPageNumber(searchMatchPages[index] ?? 1);
            }}
            type="button"
          >Previous match</button>
          <button
            aria-label="Next PDF search result"
            className="rounded-lg border border-line px-2 py-1.5 text-ink disabled:opacity-40"
            disabled={searching || searchMatchPages.length === 0}
            onClick={() => {
              const index = (searchResultIndex + 1) % searchMatchPages.length;
              setSearchResultIndex(index);
              setPageNumber(searchMatchPages[index] ?? 1);
            }}
            type="button"
          >Next match</button>
        </div>
        <div className="flex items-center gap-2">
          <button
            aria-pressed={fitWidth}
            className="rounded-lg border border-line px-2.5 py-1.5 text-[11px] text-ink hover:bg-subtle aria-pressed:bg-brand-soft aria-pressed:text-brand"
            onClick={() => setFitWidth((fit) => !fit)}
            type="button"
          >
            {fitWidth ? "Fit width" : "Fit to width"}
          </button>
          <button
            aria-label="Zoom out"
            className="grid size-8 place-items-center rounded-lg border border-line text-ink hover:bg-subtle"
            disabled={fitWidth}
            onClick={() => setZoom((value) => Math.max(50, value - 10))}
            type="button"
          >
            −
          </button>
          <span className="w-10 text-center text-[10px] text-muted">{zoom}%</span>
          <button
            aria-label="Zoom in"
            className="grid size-8 place-items-center rounded-lg border border-line text-ink hover:bg-subtle"
            disabled={fitWidth}
            onClick={() => setZoom((value) => Math.min(200, value + 10))}
            type="button"
          >
            +
          </button>
        </div>
      </div>
      {error ? (
        <p className="m-4 rounded-xl border border-red-200 bg-red-50 p-3 text-[12px] text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200" role="alert">
          {error}
        </p>
      ) : (
        <div
          className="relative flex max-h-[75vh] min-h-72 justify-center overflow-auto bg-subtle p-4"
          ref={containerRef}
        >
          {(loading || rendering) && (
            <p className="absolute left-1/2 top-5 -translate-x-1/2 rounded-lg bg-surface/90 px-3 py-2 text-[11px] text-muted shadow-soft" role="status">
              {loading ? "Loading PDF…" : "Rendering page…"}
            </p>
          )}
          <canvas
            aria-label={`${fileName}, page ${pageNumber}`}
            className="h-fit max-w-full bg-white shadow-panel"
            ref={canvasRef}
          />
        </div>
      )}
    </section>
  );
}
