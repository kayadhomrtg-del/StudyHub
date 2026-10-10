import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import type { MaterialRecord } from "./material";
import { PdfViewer } from "./PdfViewer";
import { OfficePreview } from "./OfficePreview";

interface MaterialFileViewerProps {
  material: MaterialRecord;
  bytes: ArrayBuffer;
}

type ViewerKind = "pdf" | "image" | "text" | "office" | "unsupported";

const textExtensions = new Set([
  "txt", "md", "markdown", "cpp", "cc", "cxx", "h", "hpp", "c", "js", "jsx",
  "mjs", "cjs", "ts", "tsx", "html", "htm", "css", "json", "xml", "yaml",
  "yml", "py", "java", "cs", "go", "rs", "sql", "sh", "bash", "toml", "ini",
  "log", "csv", "properties", "php", "rb", "swift", "kt", "vue", "svelte",
]);
const imageExtensions = new Set(["png", "jpg", "jpeg", "gif", "webp", "bmp", "avif", "ico"]);

function getViewerKind(material: MaterialRecord): ViewerKind {
  const extension = material.extension ?? "";
  if (extension === "pdf" || material.mimeType === "application/pdf") return "pdf";
  if (["docx", "pptx", "xlsx", "xlsm"].includes(extension)) return "office";
  if (imageExtensions.has(extension) || /^image\/(png|jpeg|gif|webp|bmp|avif|x-icon)$/i.test(material.mimeType)) {
    return "image";
  }
  if (
    textExtensions.has(extension) ||
    material.mimeType.startsWith("text/") ||
    material.mimeType === "application/json" ||
    material.mimeType === "application/xml"
  ) {
    return "text";
  }
  return "unsupported";
}

function useObjectUrl(bytes: ArrayBuffer, mimeType: string) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let nextUrl: string;
    setUrl("");
    setError("");
    try {
      nextUrl = URL.createObjectURL(
        new Blob([bytes.slice(0)], { type: mimeType || "application/octet-stream" }),
      );
      setUrl(nextUrl);
    } catch (urlError) {
      setError(
        urlError instanceof Error
          ? `A local file link could not be created: ${urlError.message}`
          : "A local file link could not be created.",
      );
      return;
    }
    return () => URL.revokeObjectURL(nextUrl);
  }, [bytes, mimeType]);

  return { url, error };
}

function formatFileSize(sizeBytes: number): string {
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DownloadOriginal({
  material,
  bytes,
}: MaterialFileViewerProps) {
  const { url, error } = useObjectUrl(bytes, material.mimeType);
  if (error) return <p className="mt-4 text-[12px] text-red-700 dark:text-red-200" role="alert">{error}</p>;
  if (!url) return <p className="mt-4 text-[11px] text-muted" role="status">Preparing original file…</p>;
  return (
    <a
      className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-[12px] font-semibold text-white hover:bg-brand-strong"
      download={material.originalFileName}
      href={url}
    >
      <Download aria-hidden="true" size={15} />
      Download original
    </a>
  );
}

function ImageViewer({ material, bytes }: MaterialFileViewerProps) {
  const { url, error } = useObjectUrl(bytes, material.mimeType);
  const [loaded, setLoaded] = useState(false);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    setLoaded(false);
    setInvalid(false);
  }, [url]);

  if (error) return <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-[12px] text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200" role="alert">{error}</p>;
  if (!url) return <p className="rounded-xl border border-line bg-surface p-5 text-[12px] text-muted" role="status">Loading image…</p>;
  if (invalid) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-6">
        <p className="text-[13px] font-medium text-ink" role="alert">This image could not be opened. The file may be damaged.</p>
      </div>
    );
  }
  return (
    <div className="relative flex min-h-64 justify-center rounded-2xl border border-line bg-subtle p-4">
      {!loaded && <p className="absolute top-6 text-[11px] text-muted" role="status">Loading image…</p>}
      <img
        alt={material.originalFileName}
        className={`max-h-[75vh] max-w-full object-contain ${loaded ? "" : "invisible"}`}
        onError={() => setInvalid(true)}
        onLoad={() => setLoaded(true)}
        src={url}
      />
    </div>
  );
}

export function MaterialFileViewer({ material, bytes }: MaterialFileViewerProps) {
  const kind = getViewerKind(material);
  if (kind === "office") return <OfficePreview bytes={bytes} material={material} />;
  switch (kind) {
    case "pdf":
      return <PdfViewer bytes={bytes} fileName={material.originalFileName} />;
    case "image":
      return <ImageViewer bytes={bytes} material={material} />;
    case "text":
      return <OfficePreview bytes={bytes} material={material} />;
    case "unsupported":
      return (
        <section
          aria-labelledby="unsupported-file-heading"
          className="rounded-2xl border border-line bg-surface p-6 shadow-panel sm:p-8"
        >
          <h2 className="text-[15px] font-semibold text-ink" id="unsupported-file-heading">
            Preview not available
          </h2>
          <p className="mt-2 text-[12px] leading-6 text-muted">
            This file format is not supported for in-app preview. The locally stored original file is unchanged.
          </p>
          <dl className="mt-5 grid gap-3 border-t border-line pt-4 text-[11px] sm:grid-cols-[140px_1fr]">
            <dt className="font-medium text-muted">Filename</dt>
            <dd className="break-all text-ink">{material.originalFileName}</dd>
            <dt className="font-medium text-muted">Type</dt>
            <dd className="break-all text-ink">{material.mimeType}</dd>
            <dt className="font-medium text-muted">File size</dt>
            <dd className="text-ink">{formatFileSize(material.sizeBytes)}</dd>
          </dl>
        </section>
      );
  }
}
