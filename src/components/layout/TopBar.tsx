import { Menu, Moon, Sun } from "lucide-react";
import { useLocation } from "react-router-dom";
import { navigationItems } from "../../features/navigation/navigation";
import { useTheme } from "../theme/useTheme";

interface TopBarProps {
  onMenuClick: () => void;
}

export function TopBar({ onMenuClick }: TopBarProps) {
  const { pathname } = useLocation();
  const { theme, toggleTheme } = useTheme();
  const currentPage =
    navigationItems.find(
      (item) =>
        item.path === pathname ||
        (item.path !== "/" && pathname.startsWith(`${item.path}/`)),
    ) ?? navigationItems[0];

  return (
    <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between border-b border-line bg-surface/90 px-5 backdrop-blur-md sm:px-8 xl:px-12">
      <div className="flex min-w-0 items-center gap-3">
        <button
          aria-label="Open navigation menu"
          className="grid size-9 shrink-0 place-items-center rounded-xl text-muted hover:bg-subtle lg:hidden"
          onClick={onMenuClick}
          type="button"
        >
          <Menu aria-hidden="true" size={19} />
        </button>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-ink">
            {currentPage.label}
          </p>
          <p className="mt-0.5 hidden text-[11px] text-muted sm:block">
            A little progress, every day.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        <span className="hidden items-center gap-1.5 rounded-full border border-line bg-canvas px-2.5 py-1.5 text-[10px] font-medium text-muted md:inline-flex">
          <span className="size-1.5 rounded-full bg-brand" />
          Local-first foundation
        </span>
        <button
          aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
          aria-pressed={theme === "dark"}
          className="grid size-9 place-items-center rounded-xl border border-line bg-surface text-muted transition-colors hover:bg-subtle hover:text-ink"
          onClick={toggleTheme}
          type="button"
        >
          {theme === "light" ? (
            <Moon aria-hidden="true" size={16} />
          ) : (
            <Sun aria-hidden="true" size={16} />
          )}
        </button>
        <div
          aria-label="Your profile"
          className="grid size-9 place-items-center rounded-full bg-[#e9eee8] text-[11px] font-bold text-[#526858] dark:bg-[#25352c] dark:text-[#b9d2c0]"
        >
          S
        </div>
      </div>
    </header>
  );
}
