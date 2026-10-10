import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SettingsPage } from "./SettingsPage";

function stubStorage(storage: StorageManager | undefined) {
  const browserNavigator = Object.create(navigator) as Navigator;
  Object.defineProperty(browserNavigator, "storage", { configurable: true, value: storage });
  vi.stubGlobal("navigator", browserNavigator);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SettingsPage storage controls", () => {
  it("shows usage and quota and reports a denied persistence request", async () => {
    const user = userEvent.setup();
    const storage = {
      estimate: vi.fn().mockResolvedValue({ usage: 1024, quota: 4096 }),
      persisted: vi.fn().mockResolvedValue(false),
      persist: vi.fn().mockResolvedValue(false),
    } as unknown as StorageManager;
    stubStorage(storage);
    render(<SettingsPage />);

    expect(await screen.findByText("1.0 KB")).toBeInTheDocument();
    expect(screen.getByText("4.0 KB")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /request persistent storage/i }));
    expect(await screen.findByText(/was not granted/i)).toBeInTheDocument();
    expect(storage.persist).toHaveBeenCalledOnce();
  });

  it("reports when the browser does not provide storage estimates or persistence", async () => {
    const user = userEvent.setup();
    stubStorage(undefined);
    render(<SettingsPage />);

    expect(await screen.findByText(/storage estimates are not available/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /request persistent storage/i }));
    expect(await screen.findByText(/does not support a persistent-storage request/i)).toBeInTheDocument();
  });
});
