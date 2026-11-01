import {
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import JSZip from "jszip";
import { beforeEach, describe, expect, it } from "vitest";

import { BackupService } from "../backup/BackupService";
import { moduleDatabase } from "../modules/moduleDatabase";
import type { NoteDraft, NoteRecord } from "../notes/note";
import { AiSummaryPage } from "./AiSummaryPage";
import {
  AI_DISCLOSURES,
  AI_PREPARE_DISCLOSURE,
} from "./disclosures";
import { LOCAL_SUMMARY_NOTICE } from "./localSummary";
import {
  AI_APPROVAL_WORDING,
  AI_DIGEST_EXPLANATION,
} from "./PayloadPreview";
import type { PersonalNotesStore } from "./PersonalNotesPanel";
import {
  createStubAiFetch,
  type StubAiFetchOptions,
} from "./testing/stubAiFetch";

const SOURCE_TEXT =
  "The water cycle moves water through evaporation, condensation, and precipitation. It is driven by energy from the sun.";
const FIXED_NOW = Date.parse("2026-10-31T12:00:00.000Z");
const NOTE_SENTINEL = "PRIVATE-NOTE-SENTINEL";

interface MemoryNotesStore extends PersonalNotesStore {
  notes: NoteRecord[];
}

function createMemoryNotesStore(initial: NoteRecord[] = []): MemoryNotesStore {
  const notes = initial.map((note) => ({ ...note }));
  let nextId = notes.length;

  return {
    notes,
    async getAll() {
      return notes.map((note) => ({ ...note }));
    },
    async create() {
      nextId += 1;
      const timestamp = `2026-10-31T12:00:${String(nextId).padStart(2, "0")}.000Z`;
      const note: NoteRecord = {
        id: `note-${nextId}`,
        title: "",
        markdown: "",
        tags: [],
        isPinned: false,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      notes.push(note);
      return { ...note };
    },
    async saveDraft(id: string, draft: NoteDraft) {
      const index = notes.findIndex((note) => note.id === id);
      if (index < 0) throw new Error("The test note no longer exists.");
      const updated: NoteRecord = {
        ...notes[index],
        ...draft,
        id,
        updatedAt: `2026-10-31T12:01:${String(index).padStart(2, "0")}.000Z`,
      };
      notes[index] = updated;
      return { ...updated };
    },
  };
}

function renderPage(
  stubOptions: StubAiFetchOptions = {},
  notesStore = createMemoryNotesStore(),
) {
  const stub = createStubAiFetch(stubOptions);
  const view = render(
    <AiSummaryPage
      fetch={stub.fetch}
      notesStore={notesStore}
      now={() => FIXED_NOW}
      source={{
        id: "material-water-cycle",
        title: "Water cycle notes",
        text: SOURCE_TEXT,
      }}
    />,
  );
  return { stub, notesStore, ...view };
}

async function prepareAndApprove(
  user: ReturnType<typeof userEvent.setup>,
) {
  await user.click(screen.getByRole("button", { name: "Prepare exact payload" }));
  await screen.findByLabelText("Exact outbound payload text");
  await user.click(
    screen.getByRole("checkbox", { name: AI_APPROVAL_WORDING }),
  );
}

describe("AiSummaryPage", () => {
  beforeEach(async () => {
    await moduleDatabase.notes.clear();
  });

  it("renders all M1-M8 disclosures verbatim, non-editable, with the loopback note separate", () => {
    renderPage();

    const disclosures = screen.getByRole("region", {
      name: "Read these before using AI summaries",
    });

    for (const disclosure of AI_DISCLOSURES) {
      expect(within(disclosures).getByText(disclosure.text)).toBeInTheDocument();
    }
    expect(within(disclosures).getByText(AI_PREPARE_DISCLOSURE)).toBeInTheDocument();
    expect(
      within(within(disclosures).getByRole("list")).getAllByRole("listitem"),
    ).toHaveLength(8);
    expect(within(disclosures).queryByRole("textbox")).not.toBeInTheDocument();
    expect(within(disclosures).queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows the exact preview, requires approval, and dispatches the same payload", async () => {
    const user = userEvent.setup();
    const { stub, notesStore } = renderPage();

    const notesField = screen.getByLabelText("Personal notes (stored locally)");
    await waitFor(() => expect(notesField).toBeEnabled());
    await user.type(notesField, NOTE_SENTINEL);
    await user.click(screen.getByRole("button", { name: "Save notes locally" }));
    await waitFor(() => expect(notesStore.notes).toHaveLength(1));
    expect(notesStore.notes[0].markdown).toContain(NOTE_SENTINEL);

    await user.click(
      screen.getByRole("button", { name: "Prepare exact payload" }),
    );
    const preview = await screen.findByLabelText("Exact outbound payload text");
    await waitFor(() => expect(stub.prepared).toHaveLength(1));
    const previewText = preview.textContent;

    expect(previewText).toBe(stub.prepared[0].payloadText);
    expect(previewText).not.toContain(NOTE_SENTINEL);
    expect(stub.prepared[0].payload.input).toBe(SOURCE_TEXT);
    expect(stub.prepared[0].payload.input).not.toContain(NOTE_SENTINEL);

    const metadata = screen.getByLabelText("Payload metadata");
    expect(
      within(metadata).getByText(stub.prepared[0].payload.model),
    ).toBeInTheDocument();
    expect(
      within(metadata).getByText(
        `${stub.prepared[0].payloadBytes} bytes`,
      ),
    ).toBeInTheDocument();
    expect(
      within(metadata).getByText(stub.prepared[0].expiresAt),
    ).toBeInTheDocument();
    expect(
      within(metadata).getByText(stub.prepared[0].digest),
    ).toBeInTheDocument();
    expect(screen.getByText(AI_DIGEST_EXPLANATION)).toBeInTheDocument();

    const sendButton = screen.getByRole("button", {
      name: "Send approved request",
    });
    expect(sendButton).toBeDisabled();

    await user.click(
      screen.getByRole("checkbox", { name: AI_APPROVAL_WORDING }),
    );
    expect(sendButton).toBeEnabled();
    await user.click(sendButton);

    expect(
      await screen.findByText("A deterministic stub summary."),
    ).toBeInTheDocument();
    expect(stub.dispatched).toHaveLength(1);
    expect(stub.dispatched[0].payloadText).toBe(previewText);
    expect(stub.dispatched[0].payload.input).not.toContain(NOTE_SENTINEL);

    const sendCall = stub.calls.find((call) => call.route === "/api/ai/send");
    expect(sendCall).toBeDefined();
    const body = sendCall?.body as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(["digest", "token"]);
    expect(stub.calls).toHaveLength(2);
  });

  it("clears approval and uses a new token after a new preparation", async () => {
    const user = userEvent.setup();
    const { stub } = renderPage();

    await prepareAndApprove(user);
    await user.click(
      screen.getByRole("button", { name: "Send approved request" }),
    );
    await screen.findByText("A deterministic stub summary.");
    expect(
      stub.calls.filter((call) => call.route === "/api/ai/send"),
    ).toHaveLength(1);

    await user.click(
      screen.getByRole("button", { name: "Prepare a new exact payload" }),
    );
    const checkbox = await screen.findByRole("checkbox", {
      name: AI_APPROVAL_WORDING,
    });
    expect(checkbox).not.toBeChecked();
    expect(
      screen.getByRole("button", { name: "Send approved request" }),
    ).toBeDisabled();
    expect(
      stub.calls.filter((call) => call.route === "/api/ai/prepare"),
    ).toHaveLength(2);
    expect(
      stub.calls.filter((call) => call.route === "/api/ai/send"),
    ).toHaveLength(1);
    expect(stub.prepared[1].token).not.toBe(stub.prepared[0].token);
  });

  it("provides a deterministic local fallback from idle with zero fetch calls", async () => {
    const user = userEvent.setup();
    const { stub } = renderPage();

    await user.click(
      screen.getByRole("button", { name: "Use local fallback" }),
    );

    expect(
      screen.getByRole("heading", { name: "Local fallback summary" }),
    ).toBeInTheDocument();
    expect(screen.getByText(LOCAL_SUMMARY_NOTICE)).toBeInTheDocument();
    expect(
      screen.getByText(/The water cycle moves water through evaporation/),
    ).toBeInTheDocument();
    expect(stub.calls).toHaveLength(0);
    expect(
      screen.queryByRole("button", { name: /retry|try again/i }),
    ).not.toBeInTheDocument();
  });

  it("presents a pre-dispatch refusal as Not sent and keeps the fallback available", async () => {
    const user = userEvent.setup();
    const { stub } = renderPage({
      prepare: {
        kind: "error",
        code: "terms_not_eligible",
        message: "Provider eligibility is unresolved.",
      },
    });

    await user.click(
      screen.getByRole("button", { name: "Prepare exact payload" }),
    );

    expect(await screen.findByText("Not sent")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Local proxy message: Provider eligibility is unresolved.",
      ),
    ).toBeInTheDocument();
    expect(stub.calls).toHaveLength(1);
    expect(
      screen.getByLabelText("Personal notes (stored locally)"),
    ).toBeEnabled();
    expect(
      screen.queryByRole("button", { name: /retry|try again/i }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Use local fallback" }),
    );
    expect(
      screen.getByRole("heading", { name: "Local fallback summary" }),
    ).toBeInTheDocument();
    expect(stub.calls).toHaveLength(1);
  });

  it("presents a post-dispatch failure distinctly from Not sent", async () => {
    const user = userEvent.setup();
    const { stub } = renderPage({
      send: {
        kind: "error",
        code: "upstream_error",
        message: "The provider returned an error.",
        upstreamAttempted: true,
        status: 502,
      },
    });

    await prepareAndApprove(user);
    await user.click(
      screen.getByRole("button", { name: "Send approved request" }),
    );

    expect(
      await screen.findByText("Request failed after sending"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Not sent")).not.toBeInTheDocument();
    expect(stub.dispatched).toHaveLength(1);
    expect(stub.calls).toHaveLength(2);
  });

  it("never labels an unknown send outcome as Not sent", async () => {
    const user = userEvent.setup();
    const { stub } = renderPage({
      send: { kind: "network_error", message: "socket closed" },
    });

    await prepareAndApprove(user);
    await user.click(
      screen.getByRole("button", { name: "Send approved request" }),
    );

    expect(
      await screen.findByText("Request outcome unknown"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Not sent")).not.toBeInTheDocument();
    expect(stub.dispatched).toHaveLength(1);
    expect(stub.calls).toHaveLength(2);
    expect(
      screen.queryByRole("button", { name: /retry|try again/i }),
    ).not.toBeInTheDocument();
  });

  it("shows partial output and the truncation warning for an incomplete response", async () => {
    const user = userEvent.setup();
    const partial = '{"summary":"A partial summary.","keyPoints":[]}';
    const { stub } = renderPage({
      send: { kind: "incomplete", outputText: partial },
    });

    await prepareAndApprove(user);
    await user.click(
      screen.getByRole("button", { name: "Send approved request" }),
    );

    expect(
      await screen.findByText("Request failed after sending"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Partial AI output")).toHaveTextContent(
      partial,
    );
    expect(
      screen.getByText(/not a complete summary/i),
    ).toBeInTheDocument();
    expect(screen.getByText("A partial summary.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Use local fallback" }),
    ).toBeInTheDocument();
    expect(stub.dispatched).toHaveLength(1);
  });

  it("keeps AI data out of IndexedDB and backups while preserving schema v7 and backup v2", async () => {
    const user = userEvent.setup();
    const stub = createStubAiFetch();
    render(
      <AiSummaryPage
        fetch={stub.fetch}
        now={() => FIXED_NOW}
        source={{
          id: "material-persistence-check",
          title: "Persistence check",
          text: SOURCE_TEXT,
        }}
      />,
    );

    await prepareAndApprove(user);
    await user.click(
      screen.getByRole("button", { name: "Send approved request" }),
    );
    await screen.findByText("A deterministic stub summary.");

    const stored = await Promise.all(
      moduleDatabase.tables.map(async (table) => ({
        name: table.name,
        rows: await table.toArray(),
      })),
    );
    const serialized = JSON.stringify(stored);
    expect(serialized).not.toContain(SOURCE_TEXT);
    expect(serialized).not.toContain("A deterministic stub summary.");
    expect(stored.find((table) => table.name === "notes")?.rows).toHaveLength(0);

    expect(moduleDatabase.verno).toBe(7);
    expect(stored.map((table) => table.name).sort()).toEqual([
      "appSettings",
      "materials",
      "modules",
      "notes",
      "storedFiles",
      "studySessions",
      "tasks",
      "topics",
    ]);

    const backup = await new BackupService(moduleDatabase).createFullBackup();
    const archive = await JSZip.loadAsync(backup);
    const manifestText = await archive.file("manifest.json")!.async("string");
    const recordsText = await archive.file("records.json")!.async("string");
    const manifest = JSON.parse(manifestText) as { kind: string; version: number };
    const records = JSON.parse(recordsText) as Record<string, unknown>;

    expect(manifest).toMatchObject({ kind: "full", version: 2 });
    expect(Object.keys(records).sort()).toEqual([
      "materials",
      "modules",
      "notes",
      "settings",
      "studySessions",
      "tasks",
      "topics",
    ]);
    expect(`${manifestText}\n${recordsText}`).not.toContain(SOURCE_TEXT);
    expect(`${manifestText}\n${recordsText}`).not.toContain(
      "A deterministic stub summary.",
    );
  });
});
