import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AppRoutes } from "./App";
import { ThemeProvider } from "./components/theme/ThemeProvider";
import { ConfirmationDialog } from "./components/ui/ConfirmationDialog";
import { ErrorState, LoadingState } from "./components/ui/StatePanel";
import { workspacePages } from "./pages/workspacePages";

function renderApp(initialEntry = "/") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <ThemeProvider>
        <AppRoutes />
      </ThemeProvider>
    </MemoryRouter>,
  );
}

describe("application foundation", () => {
  it("renders the dashboard with an active navigation link", () => {
    renderApp();

    expect(
      screen.getByRole("heading", { name: /good .* scholar/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /^Dashboard$/ }),
    ).toHaveAttribute("aria-current", "page");
  });

  it("navigates to every primary page and indicates the active page", async () => {
    const user = userEvent.setup();
    renderApp();

    for (const page of workspacePages) {
      const navigationLabel =
        page.path === "/planner"
          ? "Study planner"
          : page.path.slice(1).replace(/^./, (letter) => letter.toUpperCase());

      await user.click(screen.getByRole("link", { name: navigationLabel }));
      expect(
        screen.getByRole("heading", { name: page.title }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: navigationLabel }),
      ).toHaveAttribute("aria-current", "page");
    }
  });

  it("shows a useful not-found page for unknown routes", () => {
    renderApp("/not-a-page");

    expect(
      screen.getByRole("heading", { name: "This page isn't here" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /back to dashboard/i }),
    ).toHaveAttribute("href", "/");
  });

  it("switches between light and dark appearance", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole("button", { name: "Switch to dark theme" }));
    expect(document.documentElement).toHaveClass("dark");

    await user.click(screen.getByRole("button", { name: "Switch to light theme" }));
    expect(document.documentElement).not.toHaveClass("dark");
  });
});

describe("reusable interface states", () => {
  it("announces loading and error states accessibly", () => {
    render(
      <>
        <LoadingState label="Loading modules" />
        <ErrorState message="Please try again." />
      </>,
    );

    expect(screen.getByRole("status")).toHaveAccessibleName("Loading modules");
    expect(screen.getByRole("alert")).toHaveTextContent("Please try again.");
  });

  it("only invokes confirmation after an explicit choice", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    const { rerender } = render(
      <ConfirmationDialog
        description="This action cannot be undone."
        onCancel={onCancel}
        onConfirm={onConfirm}
        open={false}
        title="Confirm action"
      />,
    );

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();

    rerender(
      <ConfirmationDialog
        description="This action cannot be undone."
        onCancel={onCancel}
        onConfirm={onConfirm}
        open
        title="Confirm action"
      />,
    );

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
