import { beforeEach, describe, expect, it, vi } from "vitest";
import { moduleDatabase } from "../modules/moduleDatabase";
import { loadStudySessionSource } from "./studySessionSource";

const timestamp = "2026-01-01T10:00:00.000Z";

function addMaterial(
  id: string,
  content: string,
  extension = "txt",
  mimeType = "text/plain",
) {
  return Promise.all([
    moduleDatabase.materials.add({
      id,
      title: id,
      originalFileName: `${id}.${extension}`,
      extension,
      mimeType,
      sizeBytes: new TextEncoder().encode(content).byteLength,
      moduleId: "recall-module",
      tags: [],
      status: "not-started",
      isFavorite: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    }),
    moduleDatabase.storedFiles.add({
      id,
      bytes: new TextEncoder().encode(content).buffer as ArrayBuffer,
    }),
  ]);
}

function addSession(
  id: string,
  materialId?: string,
  status: "planned" | "completed" | "skipped" = "planned",
) {
  return moduleDatabase.studySessions.add({
    id,
    moduleId: "recall-module",
    ...(materialId ? { materialId } : {}),
    title: id,
    plannedStart: timestamp,
    plannedDurationMinutes: 45,
    status,
    actualDurationMinutes: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

beforeEach(async () => {
  await Promise.all([
    moduleDatabase.studySessions.clear(),
    moduleDatabase.materials.clear(),
    moduleDatabase.storedFiles.clear(),
    moduleDatabase.modules.clear(),
  ]);
  await moduleDatabase.modules.add({
    id: "recall-module",
    name: "Local study",
    code: "LOCAL-1",
    isArchived: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
});

describe("loadStudySessionSource", () => {
  it("extracts the exact material linked to the requested planned session without fetching", async () => {
    await addMaterial("first-material", "First source.\nIn reading order.");
    await addMaterial("other-material", "This source belongs to another session.");
    await addSession("first-session", "first-material");
    await addSession("other-session", "other-material");
    const fetch = vi.spyOn(globalThis, "fetch");

    await expect(loadStudySessionSource("first-session")).resolves.toMatchObject({
      session: { id: "first-session", status: "planned", materialId: "first-material" },
      material: { id: "first-material" },
      text: "First source.\nIn reading order.",
    });
    expect(fetch).not.toHaveBeenCalled();
    expect(await moduleDatabase.studySessions.get("first-session")).toMatchObject({ status: "planned" });
    fetch.mockRestore();
  });

  it("reports missing session, missing material link, and non-planned session", async () => {
    await addSession("unlinked-session");
    await addMaterial("completed-material", "Completed source.");
    await addSession("completed-session", "completed-material", "completed");

    await expect(loadStudySessionSource(undefined)).rejects.toThrow("missing its study session ID");
    await expect(loadStudySessionSource("missing-session")).rejects.toThrow("could not be found");
    await expect(loadStudySessionSource("unlinked-session")).rejects.toThrow("not linked to a material");
    await expect(loadStudySessionSource("completed-session")).rejects.toThrow("only for planned");
  });

  it("reports a missing material, unsupported type, and missing original file", async () => {
    await addSession("deleted-material-session", "deleted-material");
    await addMaterial("unsupported-material", "image bytes", "png", "image/png");
    await addSession("unsupported-session", "unsupported-material");
    await addMaterial("missing-file-material", "not read");
    await moduleDatabase.storedFiles.delete("missing-file-material");
    await addSession("missing-file-session", "missing-file-material");

    await expect(loadStudySessionSource("deleted-material-session")).rejects.toThrow("linked to this study session");
    await expect(loadStudySessionSource("unsupported-session")).rejects.toThrow("cannot be read locally");
    await expect(loadStudySessionSource("missing-file-session")).rejects.toThrow("file bytes are missing");
  });

  it("reports empty extraction and extraction failures instead of opening a blank workspace", async () => {
    await addMaterial("empty-material", " \n\t ");
    await addSession("empty-session", "empty-material");
    await addMaterial("invalid-text-material", "\uFFFD");
    await moduleDatabase.storedFiles.put({
      id: "invalid-text-material",
      bytes: new Uint8Array([0xff, 0xfe]).buffer,
    });
    await addSession("invalid-text-session", "invalid-text-material");

    await expect(loadStudySessionSource("empty-session")).rejects.toThrow("No readable text");
    await expect(loadStudySessionSource("invalid-text-session")).rejects.toThrow("not valid UTF-8");
  });
});
