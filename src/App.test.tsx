import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AppRoutes } from "./App";
import { ThemeProvider } from "./components/theme/ThemeProvider";
import { ConfirmationDialog } from "./components/ui/ConfirmationDialog";
import { ErrorState, LoadingState } from "./components/ui/StatePanel";
import { navigationItems } from "./features/navigation/navigation";

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

    for (const item of navigationItems) {
      const navigation = within(
        screen.getByRole("navigation", { name: "Workspace" }),
      );
      await user.click(navigation.getByRole("link", { name: item.label }));
      if (item.path === "/") {
        expect(
          screen.getByRole("heading", { name: /Good .* scholar/i }),
        ).toBeInTheDocument();
      } else {
        const pageTitle = item.path === "/modules"
          ? "Your modules"
          : item.path === "/settings"
            ? "Settings & backups"
            : item.path === "/search"
              ? "Search your study hub"
            : item.label;
        expect(await screen.findByRole("heading", { name: pageTitle })).toBeInTheDocument();
      }
      expect(
        navigation.getByRole("link", { name: item.label }),
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
