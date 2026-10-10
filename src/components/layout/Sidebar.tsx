import { BookOpenCheck, ChevronLeft, ShieldCheck } from "lucide-react";
import { NavLink } from "react-router-dom";
import { navigationItems } from "../../features/navigation/navigation";

interface SidebarProps {
  mobileMenuOpen: boolean;
  onNavigate: () => void;
}

export function Sidebar({ mobileMenuOpen, onNavigate }: SidebarProps) {
  return (
    <aside
      aria-label="Main navigation"
      className={`fixed inset-y-0 left-0 z-50 flex w-[264px] flex-col border-r border-line bg-surface px-4 py-5 transition-transform duration-200 lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:translate-x-0 lg:visible ${
        mobileMenuOpen ? "visible translate-x-0" : "invisible -translate-x-full"
      }`}
    >
      <div className="flex items-center justify-between px-2 pb-8 pt-1">
        <NavLink
          aria-label="College Study Hub dashboard"
          className="flex items-center gap-3"
          onClick={onNavigate}
          to="/"
        >
          <span className="grid size-10 place-items-center rounded-[14px] bg-brand text-white shadow-soft">
            <BookOpenCheck aria-hidden="true" size={21} strokeWidth={2.1} />
          </span>
          <span className="leading-tight">
            <span className="block text-[14px] font-bold tracking-[-0.03em] text-ink">
              study<span className="text-brand">hub</span>
            </span>
            <span className="mt-1 block text-[10px] font-medium tracking-[0.13em] text-muted">
              YOUR STUDY SPACE
            </span>
          </span>
        </NavLink>
        <button
          aria-label="Close navigation menu"
          className="grid size-9 place-items-center rounded-lg text-muted hover:bg-subtle lg:hidden"
          onClick={onNavigate}
          type="button"
        >
          <ChevronLeft aria-hidden="true" size={18} />
        </button>
      </div>

      <p className="px-3 pb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
        Workspace
      </p>
      <nav className="flex flex-1 flex-col gap-1" aria-label="Workspace">
        {navigationItems.map(({ icon: Icon, label, path }) => (
          <NavLink
            key={path}
            end={path === "/"}
            onClick={onNavigate}
            to={path}
            className={({ isActive }) =>
              `group flex items-center gap-3 rounded-xl px-3 py-[10px] text-[13px] font-medium transition-colors ${
                isActive
                  ? "bg-brand-soft text-brand-strong"
                  : "text-muted hover:bg-subtle hover:text-ink"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  aria-hidden="true"
                  className={
                    isActive
                      ? "text-brand"
                      : "text-muted transition-colors group-hover:text-ink"
                  }
                  size={17}
                  strokeWidth={1.8}
                />
                <span>{label}</span>
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="ml-auto size-1.5 rounded-full bg-brand"
                  />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="rounded-2xl border border-line bg-canvas p-4">
        <div className="mb-2 flex items-center gap-2 text-[12px] font-semibold text-ink">
          <ShieldCheck aria-hidden="true" className="text-brand" size={15} />
          Just for you
        </div>
        <p className="text-[11px] leading-[1.65] text-muted">
          Your study space is private and stays on this device.
        </p>
        <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-2.5 py-1 text-[10px] font-semibold text-brand-strong">
          <span className="size-1.5 rounded-full bg-brand" />
          Local by design
        </span>
      </div>
    </aside>
  );
}
