import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { moduleDatabase } from "../features/modules/moduleDatabase";
import { searchService } from "../features/search/SearchService";
import { SearchPage } from "./SearchPage";

afterEach(() => vi.restoreAllMocks());

beforeEach(async () => {
  await Promise.all([
    moduleDatabase.tasks.clear(),
    moduleDatabase.notes.clear(),
    moduleDatabase.materials.clear(),
    moduleDatabase.topics.clear(),
    moduleDatabase.modules.clear(),
  ]);
});

describe("SearchPage", () => {
  it("groups matching records by category and filters to one category", async () => {
    const timestamp = "2026-10-01T10:00:00.000Z";
    await moduleDatabase.modules.add({
      id: "search-page-module", name: "World History", code: "HIST-210", isArchived: false,
      createdAt: timestamp, updatedAt: timestamp,
    });
    await moduleDatabase.notes.add({
      id: "search-page-note", title: "History revision", markdown: "Ancient empires",
      tags: [], isPinned: false, createdAt: timestamp, updatedAt: timestamp,
    });
    const user = userEvent.setup();
    render(<MemoryRouter><SearchPage /></MemoryRouter>);
    await user.type(screen.getByRole("searchbox", { name: "Search all study records" }), "history");
    expect(await screen.findByRole("heading", { name: "Modules" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Notes" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /World History HIST-210/ })).toHaveAttribute("href", "/modules/search-page-module");
    expect(screen.getByRole("link", { name: /History revision Ancient empires/ })).toHaveAttribute("href", "/notes/search-page-note");
    await user.click(screen.getByRole("button", { name: "Notes" }));
    expect(await screen.findByRole("heading", { name: "Notes" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Modules" })).not.toBeInTheDocument();
  });

  it("shows helpful empty-query and no-results states", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><SearchPage /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "Search your library" })).toBeInTheDocument();
    await user.type(screen.getByRole("searchbox", { name: "Search all study records" }), "no matching record");
    expect(await screen.findByRole("heading", { name: "No results found" })).toBeInTheDocument();
  });

  it("reports local search failures clearly", async () => {
    vi.spyOn(searchService, "search").mockRejectedValue(new Error("IndexedDB is unavailable."));
    const user = userEvent.setup();
    render(<MemoryRouter><SearchPage /></MemoryRouter>);
    await user.type(screen.getByRole("searchbox", { name: "Search all study records" }), "biology");
    expect(await screen.findByRole("alert")).toHaveTextContent("IndexedDB is unavailable.");
  });
});
