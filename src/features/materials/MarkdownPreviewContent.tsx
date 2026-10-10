import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownPreviewContentProps {
  source: string;
}

export function MarkdownPreviewContent({ source }: MarkdownPreviewContentProps) {
  return (
    <ReactMarkdown
      components={{
        img: ({ src, alt }) =>
          src?.startsWith("data:image/") ? <img alt={alt ?? ""} src={src} /> : <span>{alt || "External image omitted"}</span>,
      }}
      remarkPlugins={[remarkGfm]}
    >
      {source}
    </ReactMarkdown>
  );
}
