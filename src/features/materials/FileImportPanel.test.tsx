import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { moduleDatabase } from "../modules/moduleDatabase";
import { FileImportPanel } from "./FileImportPanel";

beforeEach(async () => {
  await Promise.all([
    moduleDatabase.modules.clear(),
    moduleDatabase.topics.clear(),
    moduleDatabase.materials.clear(),
    moduleDatabase.storedFiles.clear(),
  ]);
});

describe("FileImportPanel", () => {
  it("imports multiple same-named files from the picker and reports each result", async () => {
    const { container } = render(<FileImportPanel />);
    const input = container.querySelector('input[type="file"]');
    if (!(input instanceof HTMLInputElement)) {
      throw new Error("The multiple-file input was not rendered.");
    }

    const files = [
      new File(["first copy"], "shared-notes.txt", { type: "text/plain" }),
      new File(["second copy"], "shared-notes.txt", { type: "text/plain" }),
    ];
    fireEvent.change(input, { target: { files } });

    expect(await screen.findAllByText("shared-notes.txt")).toHaveLength(2);
    expect(screen.getAllByText("Saved")).toHaveLength(2);
    await waitFor(async () => {
      expect(await moduleDatabase.materials.count()).toBe(2);
      expect(await moduleDatabase.storedFiles.count()).toBe(2);
    });

    const storedMaterials = await moduleDatabase.materials.toArray();
    const storedBytes = await Promise.all(
      storedMaterials.map(async (material) =>
        new TextDecoder().decode(
          (await moduleDatabase.storedFiles.get(material.id))?.bytes,
        ),
      ),
    );
    expect(storedBytes.sort()).toEqual(["first copy", "second copy"]);
    expect(storedMaterials.every((material) => !material.moduleId)).toBe(true);
  });

  it("reports quota failures separately without leaving a file record", async () => {
    const { container } = render(<FileImportPanel />);
    const input = container.querySelector('input[type="file"]');
    if (!(input instanceof HTMLInputElement)) {
      throw new Error("The multiple-file input was not rendered.");
    }

    vi.spyOn(moduleDatabase.materials, "add").mockRejectedValueOnce(
      new DOMException("Storage full", "QuotaExceededError"),
    );
    fireEvent.change(input, {
      target: {
        files: [new File(["will not fit"], "large-file.txt", { type: "text/plain" })],
      },
    });
    expect(await screen.findByText(/Not enough browser storage/)).toBeInTheDocument();
    expect(screen.getByText("Failed")).toBeInTheDocument();
    expect(await moduleDatabase.materials.count()).toBe(0);
    expect(await moduleDatabase.storedFiles.count()).toBe(0);
  });

  it("accepts files dropped onto the import area", async () => {
    render(<FileImportPanel />);
    const dropZone = screen.getByText("Drag files here to add them").parentElement;
    if (!dropZone) throw new Error("The file drop area was not rendered.");

    const droppedFile = new File(["dropped bytes"], "week-notes.txt", {
      type: "text/plain",
    });
    fireEvent.dragEnter(dropZone, { dataTransfer: { files: [droppedFile] } });
    expect(dropZone.className).toContain("border-brand");

    fireEvent.drop(dropZone, { dataTransfer: { files: [droppedFile] } });
    expect(await screen.findByText("week-notes.txt")).toBeInTheDocument();
    expect(screen.getByText("Saved")).toBeInTheDocument();
    expect(await moduleDatabase.materials.count()).toBe(1);
  });
});
