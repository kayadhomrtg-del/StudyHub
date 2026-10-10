import { EmptyState } from "../components/ui/StatePanel";
import type { WorkspacePageInfo } from "./workspacePages";

interface WorkspacePageProps {
  page: WorkspacePageInfo;
}

export function WorkspacePage({ page }: WorkspacePageProps) {
  const Icon = page.icon;

  return (
    <div className="animate-fade-in">
      <div className="mb-7">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.17em] text-brand">
          {page.eyebrow}
        </p>
        <h1 className="text-[28px] font-semibold tracking-[-0.045em] text-ink sm:text-[32px]">
          {page.title}
        </h1>
        <p className="mt-2 max-w-2xl text-[13px] leading-6 text-muted">
          {page.description}
        </p>
      </div>
      <section
        aria-label={page.title}
        className="rounded-[22px] border border-line bg-surface shadow-panel"
      >
        <EmptyState
          description={page.emptyDescription}
          icon={<Icon aria-hidden="true" size={20} strokeWidth={1.8} />}
          title={page.emptyTitle}
        />
      </section>
    </div>
  );
}
