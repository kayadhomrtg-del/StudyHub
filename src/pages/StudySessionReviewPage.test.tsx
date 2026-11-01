import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { moduleDatabase } from "../features/modules/moduleDatabase";
import { noteService } from "../features/notes/NoteService";
import { studySessionService } from "../features/studySessions/StudySessionService";
import { StudySessionReviewPage } from "./StudySessionReviewPage";

const timestamp = "2026-01-01T10:00:00.000Z";
const sourceText = "Cell membranes control movement.\n\nTransport can be active or passive.";

function renderReview(sessionId = "review-session") {
  return render(
    <MemoryRouter initialEntries={[`/planner/sessions/${sessionId}/review`]}>
      <Routes>
        <Route path="/planner/sessions/:sessionId/review" element={<StudySessionReviewPage />} />
        <Route path="/planner" element={<>
          <p>Planner destination</p>
          <Link to="/planner/sessions/review-session/review">Return to review</Link>
        </>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function seedSession(options: {
  id?: string;
  materialId?: string;
  extension?: string;
  mimeType?: string;
  text?: string;
  status?: "planned" | "completed" | "skipped";
} = {}) {
  const id = options.id ?? "review-session";
  const materialId = options.materialId ?? "review-material";
  const text = options.text ?? sourceText;
  await moduleDatabase.materials.add({
    id: materialId,
    title: "Cell membranes",
    originalFileName: `cells.${options.extension ?? "txt"}`,
    extension: options.extension ?? "txt",
    mimeType: options.mimeType ?? "text/plain",
    sizeBytes: new TextEncoder().encode(text).byteLength,
    moduleId: "review-module",
    tags: [],
    status: "not-started",
    isFavorite: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  await moduleDatabase.storedFiles.add({
    id: materialId,
    bytes: new TextEncoder().encode(text).buffer as ArrayBuffer,
  });
  await moduleDatabase.studySessions.add({
    id,
    moduleId: "review-module",
    materialId,
    title: "Review cell membranes",
    plannedStart: timestamp,
    plannedDurationMinutes: 45,
    goal: "Explain transport across the membrane.",
    status: options.status ?? "planned",
    actualDurationMinutes: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

beforeEach(async () => {
  await Promise.all([
    moduleDatabase.notes.clear(),
    moduleDatabase.studySessions.clear(),
    moduleDatabase.materials.clear(),
    moduleDatabase.storedFiles.clear(),
    moduleDatabase.modules.clear(),
  ]);
  await moduleDatabase.modules.add({
    id: "review-module",
    name: "Biology",
    code: "BIO-101",
    isArchived: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
});

afterEach(() => vi.restoreAllMocks());

describe("StudySessionReviewPage", () => {
  it("keeps the full source hidden until a keyboard-accessible reveal and never auto-completes", async () => {
    const user = userEvent.setup();
    await seedSession();
    renderReview();

    expect(await screen.findByRole("heading", { name: "Review cell membranes" })).toBeInTheDocument();
    const attempt = screen.getByRole("textbox", { name: "Recall attempt" });
    expect(attempt).toBeInTheDocument();
    expect(screen.queryByLabelText("Full extracted source text")).not.toBeInTheDocument();

    const reveal = screen.getByRole("button", { name: "Reveal full source" });
    reveal.focus();
    await user.keyboard("{Enter}");
    const source = screen.getByLabelText("Full extracted source text");
    expect(source.textContent).toBe(sourceText);
    expect(attempt).toBeVisible();
    expect(await studySessionService.getById("review-session")).toMatchObject({ status: "planned" });
  });

  it("saves an ordinary material-linked note and updates the same note on repeated saves", async () => {
    const user = userEvent.setup();
    await seedSession();
    renderReview();
    const attempt = await screen.findByRole("textbox", { name: "Recall attempt" });
    await user.type(attempt, "The membrane regulates movement.");
    await user.click(screen.getByRole("button", { name: "Save recall note" }));
    expect(await screen.findByText("Saved to Notes")).toBeInTheDocument();

    const [saved] = await moduleDatabase.notes.toArray();
    expect(saved).toMatchObject({
      title: "Recall — Review cell membranes",
      markdown: "The membrane regulates movement.",
      tags: ["recall"],
      link: { type: "material", id: "review-material", label: "Cell membranes" },
    });
    expect(await moduleDatabase.studySessions.get("review-session")).toMatchObject({ status: "planned" });

    await user.clear(attempt);
    await user.type(attempt, "The membrane controls transport.");
    await user.click(screen.getByRole("button", { name: "Save changes to note" }));
    await screen.findByText("Saved to Notes");
    expect(await moduleDatabase.notes.count()).toBe(1);
    expect(await moduleDatabase.notes.get(saved.id)).toMatchObject({
      markdown: "The membrane controls transport.",
      link: { type: "material", id: "review-material" },
    });
  });

  it("reports note-save failures honestly and retries without leaving duplicate notes", async () => {
    const user = userEvent.setup();
    await seedSession();
    vi.spyOn(noteService, "createDraft").mockRejectedValueOnce(new Error("Storage is unavailable."));
    renderReview();
    await user.type(await screen.findByRole("textbox", { name: "Recall attempt" }), "My recall");
    await user.click(screen.getByRole("button", { name: "Save recall note" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("The recall attempt was not saved.");
    expect(await moduleDatabase.notes.count()).toBe(0);
    expect(await studySessionService.getById("review-session")).toMatchObject({ status: "planned" });

    await user.click(screen.getByRole("button", { name: "Save recall note" }));
    expect(await screen.findByText("Saved to Notes")).toBeInTheDocument();
    expect(await moduleDatabase.notes.count()).toBe(1);
  });

  it("requires explicit finish confirmation, saves the attempt first, and guards duplicate completion", async () => {
    const user = userEvent.setup();
    await seedSession();
    const setStatus = vi.spyOn(studySessionService, "setStatus");
    renderReview();
    await user.type(await screen.findByRole("textbox", { name: "Recall attempt" }), "A complete recall.");
    fireEvent.change(screen.getByRole("spinbutton", { name: "Actual duration (minutes, optional)" }), {
      target: { value: "37" },
    });

    await user.click(screen.getByRole("button", { name: "Finish session" }));
    expect(await screen.findByRole("alertdialog", { name: "Finish this study session?" })).toBeInTheDocument();
    expect(await studySessionService.getById("review-session")).toMatchObject({ status: "planned" });
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Keep studying" }));
    expect(await studySessionService.getById("review-session")).toMatchObject({ status: "planned" });

    await user.click(screen.getByRole("button", { name: "Finish session" }));
    const confirmation = await screen.findByRole("alertdialog", { name: "Finish this study session?" });
    const confirmButton = within(confirmation).getByRole("button", { name: "Finish session" });
    fireEvent.click(confirmButton);
    fireEvent.click(confirmButton);

    expect(await screen.findByText("Planner destination")).toBeInTheDocument();
    await waitFor(async () => {
      expect(await studySessionService.getById("review-session")).toMatchObject({
        status: "completed",
        actualDurationMinutes: 37,
      });
    });
    expect(setStatus).toHaveBeenCalledTimes(1);
    expect(await moduleDatabase.notes.count()).toBe(1);
    expect(await moduleDatabase.notes.toCollection().first()).toMatchObject({
      markdown: "A complete recall.",
      link: { type: "material", id: "review-material" },
    });
  });

  it("does not complete when saving fails and can finish later after a successful retry", async () => {
    const user = userEvent.setup();
    await seedSession();
    vi.spyOn(noteService, "createDraft").mockRejectedValueOnce(new Error("Storage is unavailable."));
    renderReview();
    await user.type(await screen.findByRole("textbox", { name: "Recall attempt" }), "Unsaved until retry.");
    await user.click(screen.getByRole("button", { name: "Finish session" }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Finish session" }));

    expect((await screen.findAllByRole("alert")).some((alert) =>
      alert.textContent?.includes("session was not completed"),
    )).toBe(true);
    expect(await studySessionService.getById("review-session")).toMatchObject({ status: "planned" });
    expect(await moduleDatabase.notes.count()).toBe(0);

    await user.click(screen.getByRole("button", { name: "Finish session" }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Finish session" }));
    expect(await screen.findByText("Planner destination")).toBeInTheDocument();
    expect(await studySessionService.getById("review-session")).toMatchObject({ status: "completed" });
    expect(await moduleDatabase.notes.count()).toBe(1);
  });

  it("drops an unsaved attempt when leaving and reopening the workspace", async () => {
    const user = userEvent.setup();
    await seedSession();
    renderReview();
    await user.type(await screen.findByRole("textbox", { name: "Recall attempt" }), "Ephemeral until saved.");
    await user.click(screen.getByRole("link", { name: "Study planner" }));
    await user.click(screen.getByRole("link", { name: "Return to review" }));

    expect(await screen.findByRole("textbox", { name: "Recall attempt" })).toHaveValue("");
    expect(await moduleDatabase.notes.count()).toBe(0);
    expect(await studySessionService.getById("review-session")).toMatchObject({ status: "planned" });
  });
});
