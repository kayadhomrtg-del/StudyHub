import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { PDFDocumentProxy } from "pdfjs-dist";

export type PdfDocument = Pick<PDFDocumentProxy, "numPages" | "getPage">;

export function openPdf(bytes: ArrayBuffer): {
  promise: Promise<PdfDocument>;
  destroy: () => Promise<void>;
} {
  let cancelled = false;
  let destroyLoadingTask = async () => {};
  const promise = import("pdfjs-dist").then((pdfjs) => {
    if (cancelled) throw new DOMException("PDF loading was cancelled.", "AbortError");
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    const loadingTask = pdfjs.getDocument({ data: new Uint8Array(bytes.slice(0)) });
    destroyLoadingTask = () => loadingTask.destroy();
    return loadingTask.promise;
  });
  return {
    promise,
    destroy: async () => {
      cancelled = true;
      await destroyLoadingTask();
    },
  };
}
