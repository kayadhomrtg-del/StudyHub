import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUpLeft } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { ErrorState, LoadingState } from "../components/ui/StatePanel";
import {
  AiSummaryPage,
  type AiSummarySource,
} from "../features/ai/AiSummaryPage";
import { extractMaterialText } from "../features/ai/extractMaterialText";
import { isMaterialTextSupported } from "../features/ai/materialTextSupport";
import { materialService } from "../features/materials/MaterialService";

interface SummaryFailure {
  title: string;
  message: string;
  retry: boolean;
  backTo: string;
  backLabel: string;
}

function backToMaterial(materialId: string): Pick<
  SummaryFailure,
  "backTo" | "backLabel"
> {
  return {
    backTo: `/materials/${materialId}`,
    backLabel: "Back to material",
  };
}

export function MaterialSummaryPage() {
  const { materialId } = useParams();
  const requestId = useRef(0);
  const [source, setSource] = useState<AiSummarySource | null>(null);
  const [failure, setFailure] = useState<SummaryFailure | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSource = useCallback(async () => {
    const currentRequest = ++requestId.current;
    setSource(null);
    setFailure(null);

    if (!materialId) {
      setFailure({
        title: "Material not found",
        message: "This summary link is missing its material ID.",
        retry: false,
        backTo: "/materials",
        backLabel: "Back to materials",
      });
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const material = await materialService.getById(materialId);
      if (currentRequest !== requestId.current) return;

      if (!material) {
        setFailure({
          title: "Material not found",
          message: "This material could not be found in local storage.",
          retry: true,
          backTo: "/materials",
          backLabel: "Back to materials",
        });
        return;
      }

      if (!isMaterialTextSupported(material)) {
        setFailure({
          title: "Summary not available for this file type",
          message:
            "Only text, PDF, Word, PowerPoint, and spreadsheet files can be summarized locally. This material's text cannot be extracted.",
          retry: false,
          ...backToMaterial(material.id),
        });
        return;
      }

      const file = await materialService.getFile(material.id);
      if (currentRequest !== requestId.current) return;

      if (!file) {
        setFailure({
          title: "Original file is missing",
          message:
            "The original file bytes are missing from local storage, so there is no text to summarize.",
          retry: true,
          ...backToMaterial(material.id),
        });
        return;
      }

      const extracted = await extractMaterialText(material, file.bytes);
      if (currentRequest !== requestId.current) return;

      if (!extracted.ok) {
        setFailure({
          title: "Summary source unavailable",
          message: extracted.message,
          retry: true,
          ...backToMaterial(material.id),
        });
        return;
      }

      setSource({
        id: material.id,
        title: material.title,
        text: extracted.value.text,
      });
    } catch (error) {
      if (currentRequest !== requestId.current) return;
      setFailure({
        title: "Summary source unavailable",
        message:
          error instanceof Error
            ? error.message
            : "The material could not be prepared locally for a summary.",
        retry: true,
        ...backToMaterial(materialId),
      });
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, [materialId]);

  useEffect(() => {
    void loadSource();
    return () => {
      requestId.current += 1;
    };
  }, [loadSource]);

  if (loading) return <LoadingState label="Preparing summary source" />;

  if (failure || !source) {
    const currentFailure = failure ?? {
      title: "Summary source unavailable",
      message: "The material could not be prepared locally for a summary.",
      retry: true,
      ...(materialId ? backToMaterial(materialId) : {
        backTo: "/materials",
        backLabel: "Back to materials",
      }),
    };

    return (
      <div className="space-y-4">
        <ErrorState
          message={currentFailure.message}
          onRetry={currentFailure.retry ? () => void loadSource() : undefined}
          title={currentFailure.title}
        />
        <Link
          className="inline-flex items-center gap-2 text-[12px] font-medium text-brand hover:underline"
          to={currentFailure.backTo}
        >
          <ArrowUpLeft aria-hidden="true" size={14} />
          {currentFailure.backLabel}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Link
        className="inline-flex items-center gap-2 text-[12px] font-medium text-muted hover:text-brand"
        to={`/materials/${source.id}`}
      >
        <ArrowUpLeft aria-hidden="true" size={15} />
        Back to material
      </Link>
      <AiSummaryPage key={source.id} source={source} />
    </div>
  );
}
