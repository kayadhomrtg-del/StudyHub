import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { DashboardPage } from "./pages/DashboardPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { WorkspacePage } from "./pages/WorkspacePage";
import { workspacePages } from "./pages/workspacePages";
import { LoadingState } from "./components/ui/StatePanel";

const ModuleDetailPage = lazy(() =>
  import("./pages/ModuleDetailPage").then((module) => ({ default: module.ModuleDetailPage })),
);
const ModulesPage = lazy(() =>
  import("./pages/ModulesPage").then((module) => ({ default: module.ModulesPage })),
);
const MaterialsPage = lazy(() =>
  import("./pages/MaterialsPage").then((module) => ({ default: module.MaterialsPage })),
);
const MaterialViewerPage = lazy(() =>
  import("./pages/MaterialViewerPage").then((module) => ({ default: module.MaterialViewerPage })),
);
const AsyncSettingsPage = lazy(() =>
  import("./pages/SettingsPage").then((module) => ({ default: module.SettingsPage })),
);
const AsyncNotesPage = lazy(() =>
  import("./pages/NotesPage").then((module) => ({ default: module.NotesPage })),
);
const AsyncTasksPage = lazy(() =>
  import("./pages/TasksPage").then((module) => ({ default: module.TasksPage })),
);

function RouteLoading({ label }: { label: string }) {
  return <LoadingState label={label} />;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="modules" element={<Suspense fallback={<RouteLoading label="Loading modules" />}><ModulesPage /></Suspense>} />
        <Route path="modules/:moduleId" element={<Suspense fallback={<RouteLoading label="Loading module" />}><ModuleDetailPage /></Suspense>} />
        <Route path="materials/:materialId" element={<Suspense fallback={<RouteLoading label="Loading material" />}><MaterialViewerPage /></Suspense>} />
        <Route path="materials" element={<Suspense fallback={<RouteLoading label="Loading materials" />}><MaterialsPage /></Suspense>} />
        <Route path="notes/:noteId?" element={<Suspense fallback={<RouteLoading label="Loading notes" />}><AsyncNotesPage /></Suspense>} />
        <Route path="tasks" element={<Suspense fallback={<RouteLoading label="Loading tasks" />}><AsyncTasksPage /></Suspense>} />
        <Route path="settings" element={<Suspense fallback={<RouteLoading label="Loading settings" />}><AsyncSettingsPage /></Suspense>} />
        {workspacePages.filter((page) => page.path !== "/settings" && page.path !== "/notes" && page.path !== "/tasks").map((page) => (
          <Route
            key={page.path}
            path={page.path.slice(1)}
            element={<WorkspacePage page={page} />}
          />
        ))}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
