import { EntityType, TYPE_COLOR, TYPE_LABEL } from "../lib/data";

export interface Filters {
  query: string;
  types: Record<EntityType, boolean>;
  mentionOnly: "all" | "mention" | "noted";
}

interface Props {
  filters: Filters;
  onChange: (f: Filters) => void;
  stats: { documents: number; entities: number; relationships: number; events: number };
  onClose?: () => void;
}

const ALL_TYPES: EntityType[] = ["person", "org", "place"];

export default function Sidebar({ filters, onChange, stats, onClose }: Props) {
  return (
    <aside className="flex h-full w-72 shrink-0 flex-col gap-6 overflow-y-auto border-r border-line bg-surface p-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-ink">EP_File</h1>
          <p className="mt-0.5 text-xs text-muted">Dokument-Analyse &amp; Visualisierung</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted transition hover:bg-canvas hover:text-ink md:hidden"
            aria-label="Menü schließen"
          >
            ✕
          </button>
        )}
      </div>

      <StatGrid stats={stats} />

      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted">Suche</label>
        <input
          type="search"
          value={filters.query}
          placeholder="Name, Beziehung, Ereignis…"
          onChange={(e) => onChange({ ...filters, query: e.target.value })}
          className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
      </div>

      <div>
        <span className="mb-2 block text-xs font-medium text-muted">Entitätstyp</span>
        <div className="flex flex-col gap-1.5">
          {ALL_TYPES.map((t) => (
            <label key={t} className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={filters.types[t]}
                onChange={(e) =>
                  onChange({ ...filters, types: { ...filters.types, [t]: e.target.checked } })
                }
                className="h-4 w-4 rounded border-line accent-accent"
              />
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: TYPE_COLOR[t] }}
              />
              {TYPE_LABEL[t]}
            </label>
          ))}
        </div>
      </div>

      <div>
        <span className="mb-2 block text-xs font-medium text-muted">Status</span>
        <div className="flex flex-col gap-1.5 text-sm">
          {(
            [
              ["all", "Alle anzeigen"],
              ["mention", "Nur „genannt“"],
              ["noted", "Beleg über bloße Nennung hinaus"],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="mentionOnly"
                checked={filters.mentionOnly === value}
                onChange={() => onChange({ ...filters, mentionOnly: value })}
                className="h-4 w-4 border-line accent-accent"
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      <p className="mt-auto text-[11px] leading-relaxed text-muted">
        „Genannt“ bedeutet keine Schuld. Geschwärzte Inhalte werden nicht ausgewertet.
      </p>
    </aside>
  );
}

function StatGrid({ stats }: { stats: Props["stats"] }) {
  const items = [
    ["Dokumente", stats.documents],
    ["Entitäten", stats.entities],
    ["Beziehungen", stats.relationships],
    ["Ereignisse", stats.events],
  ] as const;
  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map(([label, value]) => (
        <div key={label} className="rounded-lg border border-line bg-canvas px-3 py-2">
          <div className="font-mono text-lg font-semibold text-ink">{value}</div>
          <div className="text-[11px] text-muted">{label}</div>
        </div>
      ))}
    </div>
  );
}
