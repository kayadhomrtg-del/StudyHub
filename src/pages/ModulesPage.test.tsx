import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { moduleDatabase } from "../features/modules/moduleDatabase";
import { ModuleDetailPage } from "./ModuleDetailPage";
import { ModulesPage } from "./ModulesPage";

function renderModuleRoutes(initialEntry = "/modules") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/modules" element={<ModulesPage />} />
        <Route path="/modules/:moduleId" element={<ModuleDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function addModule(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: "Add your first module" }));
  const dialog = within(await screen.findByRole("dialog"));
  await user.type(dialog.getByLabelText(/Module name/), "Cell Biology");
  await user.type(dialog.getByLabelText(/Module code/), "BIO-204");
  await user.type(dialog.getByLabelText("Semester"), "Spring");
  await user.type(dialog.getByLabelText("Academic year"), "2026–2027");
  await user.click(dialog.getByRole("button", { name: "Add module" }));
  await screen.findByRole("link", { name: /Cell Biology BIO-204/ });
}

beforeEach(async () => {
  await moduleDatabase.modules.clear();
});

describe("module management UI", () => {
  it("creates a module, opens its detail page, and retains it after route reload", async () => {
    const user = userEvent.setup();
    const { unmount } = renderModuleRoutes();

    await addModule(user);

    const moduleLink = await screen.findByRole("link", { name: /Cell Biology BIO-204/ });
    expect(moduleLink).toHaveAttribute("href", expect.stringMatching(/^\/modules\//));
    await user.click(moduleLink);
    expect(
      await screen.findByRole("heading", { name: "Cell Biology" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Spring")).toBeInTheDocument();

    unmount();
    renderModuleRoutes();
    expect(await screen.findByRole("link", { name: /Cell Biology BIO-204/ })).toBeInTheDocument();
  });

  it("shows field-level validation and allows searching and semester filtering", async () => {
    const user = userEvent.setup();
    renderModuleRoutes();
    await user.click(await screen.findByRole("button", { name: "Add your first module" }));
    const dialog = within(await screen.findByRole("dialog"));
    await user.click(dialog.getByRole("button", { name: "Add module" }));

    expect(await dialog.findByText("Enter a module name.")).toBeInTheDocument();
    expect(dialog.getByText("Enter a module code.")).toBeInTheDocument();

    await user.type(dialog.getByLabelText(/Module name/), "Cell Biology");
    await user.type(dialog.getByLabelText(/Module code/), "BIO-204");
    await user.type(dialog.getByLabelText("Semester"), "Spring");
    await user.click(dialog.getByRole("button", { name: "Add module" }));
    await screen.findByRole("link", { name: /Cell Biology BIO-204/ });

    const searchInput = screen.getByRole("searchbox", { name: "Search modules" });
    await user.clear(searchInput);
    await user.type(searchInput, "physics");
    expect(screen.getByText("No modules match")).toBeInTheDocument();

    await user.clear(searchInput);
    await user.selectOptions(screen.getByLabelText("Filter by semester"), "Spring");
    expect(screen.getByRole("link", { name: /Cell Biology BIO-204/ })).toBeInTheDocument();
  });

  it("archives and restores a module using the status filter", async () => {
    const user = userEvent.setup();
    renderModuleRoutes();
    await addModule(user);

    const card = screen.getByRole("article");
    await user.click(within(card).getByRole("button", { name: "Archive Cell Biology" }));
    await waitFor(() => expect(screen.queryByRole("article")).not.toBeInTheDocument());

    await user.selectOptions(screen.getByLabelText("Filter by status"), "archived");
    const archivedCard = await screen.findByRole("article");
    expect(within(archivedCard).getByText("Archived")).toBeInTheDocument();
    await user.click(
      within(archivedCard).getByRole("button", { name: "Restore Cell Biology" }),
    );
    await waitFor(() => expect(screen.queryByRole("article")).not.toBeInTheDocument());

    await user.selectOptions(screen.getByLabelText("Filter by status"), "active");
    expect(await screen.findByRole("article")).toBeInTheDocument();
  });

  it("requires an explicit confirmation before deleting a module", async () => {
    const user = userEvent.setup();
    renderModuleRoutes();
    await addModule(user);

    const card = screen.getByRole("article");
    await user.click(within(card).getByRole("button", { name: "Delete Cell Biology" }));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(await moduleDatabase.modules.count()).toBe(1);

    await user.click(screen.getByRole("button", { name: "Keep module" }));
    expect(await moduleDatabase.modules.count()).toBe(1);

    await user.click(within(card).getByRole("button", { name: "Delete Cell Biology" }));
    await user.click(screen.getByRole("button", { name: "Delete module" }));
    await waitFor(async () => expect(await moduleDatabase.modules.count()).toBe(0));
  });
});
