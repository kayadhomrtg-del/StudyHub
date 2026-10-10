import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckSquare,
  Clock3,
  FileText,
  Sparkles,
} from "lucide-react";
import { Link } from "react-router-dom";
import { EmptyState } from "../components/ui/StatePanel";

const dashboardCards = [
  {
    title: "Your modules",
    description: "Your courses and topics, all in one place.",
    icon: BookOpen,
    path: "/modules",
    empty: "No modules yet",
  },
  {
    title: "Coming up",
    description: "A clear view of what is on your horizon.",
    icon: CalendarDays,
    path: "/calendar",
    empty: "Your schedule is clear",
  },
  {
    title: "Study tasks",
    description: "Small steps that move your learning forward.",
    icon: CheckSquare,
    path: "/tasks",
    empty: "Nothing to work on yet",
  },
];

export function DashboardPage() {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="animate-fade-in">
      <div className="mb-8 flex flex-col justify-between gap-5 sm:mb-9 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.17em] text-brand">
            YOUR PERSONAL STUDY SPACE
          </p>
          <h1 className="text-[28px] font-semibold tracking-[-0.045em] text-ink sm:text-[34px]">
            {greeting}, scholar<span className="text-gold">.</span>
          </h1>
          <p className="mt-2 max-w-xl text-[13px] leading-6 text-muted">
            A little progress, every day. Your workspace is ready when you are.
          </p>
        </div>
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-line bg-surface px-3 py-2 text-[11px] font-medium text-muted shadow-soft">
          <span className="size-1.5 rounded-full bg-brand" />
          Private by design
        </div>
      </div>

      <section className="relative isolate overflow-hidden rounded-[24px] bg-[#244d3b] px-6 py-7 text-white shadow-soft sm:px-9 sm:py-9">
        <div aria-hidden="true" className="absolute -right-16 -top-28 -z-10 size-80 rounded-full border border-white/10" />
        <div aria-hidden="true" className="absolute -right-4 -top-16 -z-10 size-56 rounded-full border border-white/10" />
        <div className="max-w-xl">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[10px] font-medium tracking-wide text-white/85">
            <Sparkles aria-hidden="true" size={12} />
            A fresh start
          </span>
          <h2 className="mt-4 text-[21px] font-semibold tracking-[-0.035em] sm:text-[25px]">
            Make this space your own.
          </h2>
          <p className="mt-2 max-w-md text-[12px] leading-6 text-white/70">
            Your courses, resources, and plans will come together here—thoughtfully
            organized and always on your device.
          </p>
          <Link
            className="mt-5 inline-flex items-center gap-2 text-[12px] font-semibold text-white transition-colors hover:text-[#d6e6d9]"
            to="/modules"
          >
            Explore your modules
            <ArrowRight aria-hidden="true" size={15} />
          </Link>
        </div>
        <div aria-hidden="true" className="pointer-events-none absolute bottom-0 right-10 hidden h-[86%] w-48 items-end justify-center sm:flex">
          <div className="relative mb-[-18px] h-44 w-32 rotate-[-8deg] rounded-t-[14px] border border-white/20 bg-[#f0eee3] p-2.5 shadow-xl">
            <div className="h-full rounded-t-[7px] border border-[#d9ddcf] bg-[#f9f8f1] p-3">
              <div className="h-1.5 w-10 rounded-full bg-[#bac9b9]" />
              <div className="mt-4 h-1 w-full rounded-full bg-[#dfe3d9]" />
              <div className="mt-2 h-1 w-4/5 rounded-full bg-[#dfe3d9]" />
              <div className="mt-2 h-1 w-full rounded-full bg-[#dfe3d9]" />
              <div className="mt-5 h-8 rounded-lg bg-[#e7ece2]" />
            </div>
          </div>
          <div className="absolute bottom-0 right-0 h-36 w-28 rotate-[8deg] rounded-t-[14px] border border-white/20 bg-[#d9c9a2] p-2.5 shadow-xl">
            <div className="h-full rounded-t-[7px] bg-[#f0e8d4] p-3">
              <div className="h-1.5 w-8 rounded-full bg-[#b59b66]" />
              <div className="mt-4 h-1 w-full rounded-full bg-[#dbceb1]" />
              <div className="mt-2 h-1 w-4/5 rounded-full bg-[#dbceb1]" />
              <div className="mt-2 h-1 w-full rounded-full bg-[#dbceb1]" />
            </div>
          </div>
        </div>
      </section>

      <div className="mt-8 grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(280px,0.85fr)]">
        <section aria-labelledby="overview-heading">
          <div className="mb-4 flex items-end justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                THE BIG PICTURE
              </p>
              <h2
                className="mt-1 text-[16px] font-semibold tracking-[-0.025em] text-ink"
                id="overview-heading"
              >
                Your overview
              </h2>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {dashboardCards.map(({ description, empty, icon: Icon, path, title }) => (
              <Link
                className="group rounded-2xl border border-line bg-surface p-4 shadow-soft transition-all hover:-translate-y-0.5 hover:border-brand/30"
                key={title}
                to={path}
              >
                <div className="flex items-center justify-between">
                  <span className="grid size-9 place-items-center rounded-xl bg-brand-soft text-brand">
                    <Icon aria-hidden="true" size={17} strokeWidth={1.8} />
                  </span>
                  <ArrowRight
                    aria-hidden="true"
                    className="text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-brand"
                    size={15}
                  />
                </div>
                <h3 className="mt-4 text-[12px] font-semibold text-ink">{title}</h3>
                <p className="mt-1 text-[10px] leading-4 text-muted">{description}</p>
                <p className="mt-4 border-t border-line pt-3 text-[10px] font-medium text-muted">
                  {empty}
                </p>
              </Link>
            ))}
          </div>
        </section>

        <section
          aria-labelledby="continue-heading"
          className="rounded-2xl border border-line bg-surface p-5 shadow-soft"
        >
          <div className="mb-1 flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-xl bg-[#f6f0e3] text-[#a27b36] dark:bg-[#3c3425] dark:text-[#dec183]">
              <Clock3 aria-hidden="true" size={16} />
            </span>
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted">
                PICK UP WHERE YOU LEFT OFF
              </p>
              <h2 className="mt-0.5 text-[13px] font-semibold text-ink" id="continue-heading">
                Continue studying
              </h2>
            </div>
          </div>
          <EmptyState
            compact
            description="When you start exploring your materials, your recent work will be easy to find."
            icon={<FileText aria-hidden="true" size={19} />}
            title="Nothing here yet"
            action={
              <Link
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand hover:text-brand-strong"
                to="/materials"
              >
                Browse materials <ArrowRight aria-hidden="true" size={13} />
              </Link>
            }
          />
        </section>
      </div>
    </div>
  );
}
