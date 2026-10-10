import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import JSZip from "jszip";
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

describe("SettingsPage backup restore preview", () => {
  it("shows the complete record, file, and archive-size preview before restoring", async () => {
    const user = userEvent.setup();
    const zip = new JSZip();
    zip.file("manifest.json", JSON.stringify({
      format: "college-study-hub-backup",
      version: 2,
      appVersion: "0.1.0",
      kind: "full",
      exportedAt: "2026-04-10T12:00:00.000Z",
      counts: {
        modules: 0, topics: 0, materials: 0, notes: 0, tasks: 0,
        studySessions: 0, settings: 0, storedFiles: 0,
      },
      files: [],
    }));
    zip.file("records.json", JSON.stringify({
      modules: [], topics: [], materials: [], notes: [],
      tasks: [], studySessions: [], settings: [],
    }));
    const archive = await zip.generateAsync({ type: "arraybuffer" });
    const backupFile = new File([archive], "study-backup.zip", { type: "application/zip" });
    Object.defineProperty(backupFile, "arrayBuffer", { value: async () => archive });
    render(<SettingsPage />);

    await user.upload(
      screen.getByLabelText(/choose a college study hub zip backup/i),
      backupFile,
    );

    expect(await screen.findByText(/backup v2 · app v0\.1\.0/i)).toBeInTheDocument();
    expect(screen.getByText(/0 modules · 0 topics · 0 materials · 0 notes · 0 tasks · 0 study sessions · 0 settings · 0 original files/i)).toBeInTheDocument();
    expect(screen.getByText(/total backup:/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Restore mode")).toHaveValue("merge");
    expect(screen.getByRole("option", { name: /replace/i })).toBeInTheDocument();
  });
});
