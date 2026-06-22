import { useEffect, useMemo, useState } from "react";
import Sidebar, { Filters } from "./components/Sidebar";
import GraphView from "./components/GraphView";
import TimelineView from "./components/TimelineView";
import SummaryView from "./components/SummaryView";
import ErrorBoundary from "./components/ErrorBoundary";
import { Dataset, loadDataset } from "./lib/data";

type View = "graph" | "timeline" | "summaries";

const DEFAULT_FILTERS: Filters = {
  query: "",
  types: { person: true, org: true, place: true },
  mentionOnly: "all",
};

export default function App() {
  const [data, setData] = useState<Dataset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>("graph");
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    loadDataset().then(setData).catch((e) => setError(String(e)));
  }, []);

  const filtered = useMemo(() => {
    if (!data) return null;
    const q = filters.query.trim().toLowerCase();

    const nodes = data.nodes.filter((n) => {
      if (!filters.types[n.type]) return false;
      if (filters.mentionOnly === "mention" && !n.mention_only) return false;
      if (filters.mentionOnly === "noted" && n.mention_only) return false;
      if (q && !n.name.toLowerCase().includes(q)) return false;
      return true;
    });
    const nodeIds = new Set(nodes.map((n) => n.id));
    const links = data.links.filter((l) => nodeIds.has(l.source) && nodeIds.has(l.target));
    const events = q
      ? data.events.filter(
          (e) =>
            e.description.toLowerCase().includes(q) ||
            e.source_document.toLowerCase().includes(q),
        )
      : data.events;
    const summaries = q
      ? data.summaries.filter(
          (s) =>
            s.summary.toLowerCase().includes(q) ||
            s.source_document.toLowerCase().includes(q),
        )
      : data.summaries;

    return { nodes, links, events, summaries };
  }, [data, filters]);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center">
        <div>
          <p className="text-sm text-ink">data.json konnte nicht geladen werden.</p>
          <p className="mt-1 text-xs text-muted">{error}</p>
          <p className="mt-3 text-xs text-muted">
            Erzeuge sie mit{" "}
            <code className="font-mono">python -m ep_file.export --in samples/analysis</code>.
          </p>
        </div>
      </div>
    );
  }

  if (!data || !filtered) {
    return <div className="flex h-full items-center justify-center text-sm text-muted">Lade…</div>;
  }

  return (
    <div className="relative flex h-full">
      {/* Sidebar: ab md statisch, auf Mobil ein Drawer */}
      <div
        className={`fixed inset-y-0 left-0 z-40 transform transition-transform duration-200 md:static md:z-auto md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Sidebar
          filters={filters}
          onChange={setFilters}
          stats={data.stats}
          onClose={() => setSidebarOpen(false)}
        />
      </div>
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <main className="flex min-w-0 flex-1 flex-col">
        <DisclaimerBanner text={data.disclaimer} />

        <header className="flex items-center justify-between gap-2 border-b border-line bg-surface px-4 py-3 md:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <button
              onClick={() => setSidebarOpen(true)}
              className="shrink-0 rounded-lg border border-line p-2 text-ink transition hover:bg-canvas md:hidden"
              aria-label="Menü öffnen"
            >
              ☰
            </button>
            <div className="min-w-0 overflow-x-auto">
              <Tabs view={view} onChange={setView} />
            </div>
          </div>
          <span className="hidden shrink-0 font-mono text-[11px] text-muted lg:block">
            Stand: {new Date(data.generated_at).toLocaleString("de-DE")}
          </span>
        </header>

        <section className="min-h-0 flex-1 bg-canvas">
          <ErrorBoundary key={view}>
            {view === "graph" && (
              <GraphView nodes={filtered.nodes} links={filtered.links} data={data} />
            )}
            {view === "timeline" && <TimelineView events={filtered.events} />}
            {view === "summaries" && <SummaryView summaries={filtered.summaries} />}
          </ErrorBoundary>
        </section>
      </main>
    </div>
  );
}

function Tabs({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  const tabs: [View, string][] = [
    ["graph", "Netzwerkgraph"],
    ["timeline", "Zeitleiste"],
    ["summaries", "Zusammenfassungen"],
  ];
  return (
    <nav className="flex w-max gap-1 rounded-lg bg-canvas p-1">
      {tabs.map(([id, label]) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={`shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition ${
            view === id
              ? "bg-surface text-ink shadow-card"
              : "text-muted hover:text-ink"
          }`}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}

function DisclaimerBanner({ text }: { text: string }) {
  return (
    <div className="border-b border-amber-200 bg-amber-50 px-6 py-2 text-[12px] leading-relaxed text-amber-900">
      {text}
    </div>
  );
}
