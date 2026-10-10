import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { moduleDatabase } from "../features/modules/moduleDatabase";
import { noteService } from "../features/notes/NoteService";
import { NotesPage } from "./NotesPage";

function renderNotes(initialEntry = "/notes") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/notes/:noteId?" element={<NotesPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(async () => {
  await Promise.all([
    moduleDatabase.notes.clear(),
    moduleDatabase.modules.clear(),
    moduleDatabase.topics.clear(),
    moduleDatabase.materials.clear(),
    moduleDatabase.storedFiles.clear(),
  ]);
  await moduleDatabase.modules.add({
    id: "notes-module",
    name: "Local History",
    code: "HIST-101",
    isArchived: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });
  await moduleDatabase.topics.add({
    id: "notes-topic",
    moduleId: "notes-module",
    title: "Primary sources",
    sortOrder: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });
});

afterEach(() => vi.restoreAllMocks());

describe("NotesPage", () => {
  it("creates and autosaves Markdown, supports safe preview, and links the note to a topic", async () => {
    const user = userEvent.setup();
    renderNotes();
    await user.click(await screen.findByRole("button", { name: "New note" }));
    const title = await screen.findByRole("textbox", { name: "Title" });
    await user.type(title, "History sources");
    const source = screen.getByRole("textbox", { name: "Markdown source" });
    fireEvent.change(source, {
      target: { value: "# Evidence\n<script>window.noteInjected = true</script>\n[unsafe](javascript:alert(1))\n\n![remote image](https://example.invalid/image.png)" },
    });
    await user.selectOptions(screen.getByRole("combobox", { name: "Link note to" }), "topic");
    await user.selectOptions(await screen.findByRole("combobox", { name: "Linked topic" }), "notes-topic");
    await user.type(screen.getByRole("textbox", { name: "Tags (comma separated)" }), "source, exam");
    await screen.findByText("Saved");

    const note = await moduleDatabase.notes.toCollection().first();
    expect(note).toMatchObject({
      title: "History sources",
      markdown: "# Evidence\n<script>window.noteInjected = true</script>\n[unsafe](javascript:alert(1))\n\n![remote image](https://example.invalid/image.png)",
      tags: ["source", "exam"],
      link: { type: "topic", id: "notes-topic" },
    });

    await user.click(screen.getByRole("button", { name: /preview/i }));
    expect(await screen.findByRole("heading", { name: "Evidence" })).toBeInTheDocument();
    expect(document.querySelector("script")).toBeNull();
    expect(document.querySelector('img[src^="https://"]')).toBeNull();
    expect(window).not.toHaveProperty("noteInjected");
    expect(screen.getByText("unsafe").closest("a")).toHaveAttribute("href", "");
  });

  it("searches note content, pins notes, and requires confirmation before deletion", async () => {
    const user = userEvent.setup();
    const note = await noteService.create();
    await noteService.saveDraft(note.id, {
      title: "Exam prep",
      markdown: "Review local archives",
      tags: ["history"],
      isPinned: false,
    });
    renderNotes();
    const search = await screen.findByRole("searchbox", { name: "Search notes" });
    await user.type(search, "archives");
    expect(await screen.findByRole("link", { name: /Exam prep/ })).toBeInTheDocument();
    await user.clear(search);

    await user.click(screen.getByRole("button", { name: "Pin Exam prep" }));
    await waitFor(async () => expect(await moduleDatabase.notes.get(note.id)).toMatchObject({ isPinned: true }));

    await user.click(screen.getByRole("link", { name: /Exam prep/ }));
    await user.click(await screen.findByRole("button", { name: "Delete note" }));
    expect(await screen.findByRole("alertdialog", { name: "Delete this note?" })).toBeInTheDocument();
    expect(await moduleDatabase.notes.get(note.id)).toBeDefined();
    await user.click(within(screen.getByRole("alertdialog", { name: "Delete this note?" })).getByRole("button", { name: "Delete note" }));
    await waitFor(async () => expect(await moduleDatabase.notes.get(note.id)).toBeUndefined());
  });

  it("announces when local autosave fails and retains the editor content for retry", async () => {
    const user = userEvent.setup();
    const note = await noteService.create();
    vi.spyOn(noteService, "saveDraft").mockRejectedValue(new Error("Storage is unavailable."));
    renderNotes(`/notes/${note.id}`);

    const source = await screen.findByRole("textbox", { name: "Markdown source" });
    await user.type(source, "Unsaved draft");
    expect(await screen.findByRole("alert")).toHaveTextContent(/latest edits are not saved/i);
    expect(screen.getByRole("textbox", { name: "Markdown source" })).toHaveValue("Unsaved draft");
  });
});
