import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

export function AppShell() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-canvas text-ink lg:grid lg:grid-cols-[264px_minmax(0,1fr)]">
      {mobileMenuOpen && (
        <button
          aria-label="Close navigation menu"
          className="fixed inset-0 z-40 cursor-default bg-ink/35 backdrop-blur-[2px] lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
          type="button"
        />
      )}
      <Sidebar
        mobileMenuOpen={mobileMenuOpen}
        onNavigate={() => setMobileMenuOpen(false)}
      />
      <div className="min-w-0">
        <TopBar onMenuClick={() => setMobileMenuOpen(true)} />
        <main className="mx-auto w-full max-w-[1500px] px-5 pb-12 pt-7 sm:px-8 sm:pt-9 xl:px-12">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
