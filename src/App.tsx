import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { DashboardPage } from "./pages/DashboardPage";
import { ModuleDetailPage } from "./pages/ModuleDetailPage";
import { ModulesPage } from "./pages/ModulesPage";
import { MaterialsPage } from "./pages/MaterialsPage";
import { MaterialViewerPage } from "./pages/MaterialViewerPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { WorkspacePage } from "./pages/WorkspacePage";
import { workspacePages } from "./pages/workspacePages";

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="modules" element={<ModulesPage />} />
        <Route path="modules/:moduleId" element={<ModuleDetailPage />} />
        <Route path="materials/:materialId" element={<MaterialViewerPage />} />
        <Route path="materials" element={<MaterialsPage />} />
        {workspacePages.map((page) => (
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
