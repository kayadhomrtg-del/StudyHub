import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, CheckSquare, FileText, Search as SearchIcon, StickyNote, Tags } from "lucide-react";
import { Link } from "react-router-dom";
import { EmptyState, ErrorState, LoadingState } from "../components/ui/StatePanel";
import { searchService, type SearchCategory, type SearchResults } from "../features/search/SearchService";

const categories: { id: SearchCategory; label: string; icon: typeof BookOpen }[] = [
  { id: "modules", label: "Modules", icon: BookOpen },
  { id: "topics", label: "Topics", icon: Tags },
  { id: "materials", label: "Materials", icon: FileText },
  { id: "notes", label: "Notes", icon: StickyNote },
  { id: "tasks", label: "Tasks", icon: CheckSquare },
];

const categoryLabels: Record<SearchCategory, string> = {
  modules: "Modules",
  topics: "Topics",
  materials: "Materials",
  notes: "Notes",
  tasks: "Tasks",
};

function emptyResults(): SearchResults {
  return { modules: [], topics: [], materials: [], notes: [], tasks: [] };
}

export function SearchPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<SearchCategory | "all">("all");
  const [results, setResults] = useState<SearchResults>(emptyResults);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(0);
  const resultCount = useMemo(
    () => Object.values(results).reduce((count, items) => count + items.length, 0),
    [results],
  );

  useEffect(() => {
    const normalized = query.trim();
    const currentRequest = ++requestId.current;
    setError("");
    if (!normalized) {
      setResults(emptyResults());
      setLoading(false);
      return;
    }

    setLoading(true);
    const timer = window.setTimeout(() => {
      void searchService.search(normalized, category).then((found) => {
        if (currentRequest === requestId.current) setResults(found);
      }).catch((searchError: unknown) => {
        if (currentRequest === requestId.current) {
          setError(searchError instanceof Error ? searchError.message : "Search could not be completed.");
        }
      }).finally(() => {
        if (currentRequest === requestId.current) setLoading(false);
      });
    }, 180);
    return () => {
      window.clearTimeout(timer);
      if (requestId.current === currentRequest) requestId.current += 1;
    };
  }, [category, query]);

  return (
    <div className="animate-fade-in space-y-5">
      <header>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.17em] text-brand">FIND YOUR WAY</p>
        <h1 className="text-[28px] font-semibold tracking-[-0.045em] text-ink sm:text-[32px]">Search your study hub</h1>
        <p className="mt-2 max-w-2xl text-[13px] leading-6 text-muted">Search local modules, topics, materials, notes, and tasks. File contents stay on this device.</p>
      </header>
      <section aria-label="Global search" className="rounded-[22px] border border-line bg-surface p-4 shadow-panel sm:p-5">
        <label className="flex items-center gap-3 rounded-xl border border-line bg-canvas px-4 py-3 text-muted">
          <SearchIcon aria-hidden="true" size={17} />
          <span className="sr-only">Search all study records</span>
          <input
            aria-label="Search all study records"
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-muted"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by title, code, tag, or text…"
            type="search"
            value={query}
          />
        </label>
        <div aria-label="Search category" className="mt-3 flex flex-wrap gap-2" role="group">
          <button aria-pressed={category === "all"} className="rounded-full border border-line px-3 py-1.5 text-[10px] font-medium text-ink aria-pressed:border-brand aria-pressed:bg-brand-soft aria-pressed:text-brand" onClick={() => setCategory("all")} type="button">All</button>
          {categories.map(({ id, label }) => (
            <button aria-pressed={category === id} className="rounded-full border border-line px-3 py-1.5 text-[10px] font-medium text-ink aria-pressed:border-brand aria-pressed:bg-brand-soft aria-pressed:text-brand" key={id} onClick={() => setCategory(id)} type="button">{label}</button>
          ))}
        </div>
      </section>
      {error && <ErrorState message={error} />}
      {loading ? <LoadingState label="Searching local records" /> :
        error ? null :
          !query.trim() ? <EmptyState description="Enter a search term to find local study records." icon={<SearchIcon aria-hidden="true" size={20} />} title="Search your library" /> :
            resultCount === 0 ? <EmptyState description={`No ${category === "all" ? "records" : categoryLabels[category].toLocaleLowerCase()} matched “${query.trim()}”.`} icon={<SearchIcon aria-hidden="true" size={20} />} title="No results found" /> :
              <div className="space-y-4" aria-live="polite" aria-busy={loading}>
                {categories.filter(({ id }) => results[id].length > 0).map(({ id, icon: Icon }) => (
                  <section aria-labelledby={`search-${id}`} className="rounded-[22px] border border-line bg-surface p-4 shadow-panel" key={id}>
                    <div className="mb-3 flex items-center gap-2">
                      <span className="grid size-8 place-items-center rounded-lg bg-brand-soft text-brand"><Icon aria-hidden="true" size={15} /></span>
                      <h2 className="text-[13px] font-semibold text-ink" id={`search-${id}`}>{categoryLabels[id]}</h2>
                      <span className="text-[10px] text-muted">{results[id].length}</span>
                    </div>
                    <ul className="divide-y divide-line">
                      {results[id].map((result) => (
                        <li key={result.id}>
                          <Link className="block rounded-lg px-2 py-3 hover:bg-subtle focus-visible:outline focus-visible:outline-brand" to={result.href}>
                            <span className="block truncate text-[12px] font-semibold text-ink">{result.title || "Untitled"}</span>
                            {result.description && <span className="mt-1 block truncate text-[10px] text-muted">{result.description}</span>}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>}
    </div>
  );
}
