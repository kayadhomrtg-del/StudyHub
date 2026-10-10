import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { EmptyState } from "../components/ui/StatePanel";

export function NotFoundPage() {
  return (
    <section className="rounded-[22px] border border-line bg-surface shadow-panel">
      <EmptyState
        description="We couldn't find that page. Head back to your dashboard and continue from there."
        title="This page isn't here"
        action={
          <Link
            className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-[12px] font-semibold text-white hover:bg-brand-strong"
            to="/"
          >
            <ArrowLeft aria-hidden="true" size={15} />
            Back to dashboard
          </Link>
        }
      />
    </section>
  );
}
