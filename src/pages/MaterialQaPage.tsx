import { ArrowUpLeft } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { ErrorState, LoadingState } from "../components/ui/StatePanel";
import { AiQaPage } from "../features/ai/AiQaPage";
import { useMaterialAiSource } from "../features/ai/useMaterialAiSource";

export function MaterialQaPage() {
  const { materialId } = useParams();
  const { state, retry } = useMaterialAiSource(materialId, "Q&A");

  if (state.status === "loading") {
    return <LoadingState label="Preparing Q&A source" />;
  }

  if (state.status === "error") {
    return (
      <div className="space-y-4">
        <ErrorState
          message={state.failure.message}
          onRetry={state.failure.retry ? () => void retry() : undefined}
          title={state.failure.title}
        />
        <Link
          className="inline-flex items-center gap-2 text-[12px] font-medium text-brand hover:underline"
          to={state.failure.backTo}
        >
          <ArrowUpLeft aria-hidden="true" size={14} />
          {state.failure.backLabel}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Link
        className="inline-flex items-center gap-2 text-[12px] font-medium text-muted hover:text-brand"
        to={`/materials/${state.source.id}`}
      >
        <ArrowUpLeft aria-hidden="true" size={15} />
        Back to material
      </Link>
      <AiQaPage key={state.source.id} source={state.source} />
    </div>
  );
}
