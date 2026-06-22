import { useMemo, useState } from "react";
import { GraphCanvas, lightTheme } from "reagraph";
import { Dataset, GraphLink, GraphNode, TYPE_COLOR, TYPE_LABEL } from "../lib/data";

interface Props {
  nodes: GraphNode[];
  links: GraphLink[];
  data: Dataset;
}

export default function GraphView({ nodes, links, data }: Props) {
  const [selected, setSelected] = useState<string | null>(null);

  const visibleIds = useMemo(() => new Set(nodes.map((n) => n.id)), [nodes]);

  const rgNodes = useMemo(
    () =>
      nodes.map((n) => ({
        id: n.id,
        label: n.name,
        fill: TYPE_COLOR[n.type],
        size: 6 + Math.min(n.degree, 12) * 2,
        data: n,
      })),
    [nodes],
  );

  const rgEdges = useMemo(
    () =>
      links
        .filter((l) => visibleIds.has(l.source) && visibleIds.has(l.target))
        .map((l, i) => ({
          id: `e-${i}`,
          source: l.source,
          target: l.target,
          label: l.relation,
        })),
    [links, visibleIds],
  );

  const selectedNode = nodes.find((n) => n.id === selected) ?? null;
  const selectedLinks = useMemo(
    () =>
      selected
        ? data.links.filter((l) => l.source === selected || l.target === selected)
        : [],
    [selected, data.links],
  );

  const theme = {
    ...lightTheme,
    canvas: { ...lightTheme.canvas, background: "#FAFAF9" },
  };

  return (
    <div className="relative h-full w-full">
      {rgNodes.length === 0 ? (
        <EmptyState />
      ) : (
        <GraphCanvas
          nodes={rgNodes}
          edges={rgEdges}
          layoutType="forceDirected2d"
          labelType="all"
          theme={theme}
          onNodeClick={(node) => setSelected(node.id)}
          onCanvasClick={() => setSelected(null)}
        />
      )}

      <Legend />

      {selectedNode && (
        <DetailPanel
          node={selectedNode}
          links={selectedLinks}
          nameOf={(id) => data.nodes.find((n) => n.id === id)?.name ?? id}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function Legend() {
  return (
    <div className="absolute left-4 top-4 flex gap-3 rounded-lg border border-line bg-surface/90 px-3 py-2 text-xs shadow-card backdrop-blur">
      {(["person", "org", "place"] as const).map((t) => (
        <span key={t} className="flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: TYPE_COLOR[t] }}
          />
          {TYPE_LABEL[t]}
        </span>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full items-center justify-center text-sm text-muted">
      Keine Entitäten für die aktuellen Filter.
    </div>
  );
}

function DetailPanel({
  node,
  links,
  nameOf,
  onClose,
}: {
  node: GraphNode;
  links: GraphLink[];
  nameOf: (id: string) => string;
  onClose: () => void;
}) {
  return (
    <div className="absolute right-4 top-4 max-h-[calc(100%-2rem)] w-80 overflow-auto rounded-xl border border-line bg-surface p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-ink">{node.name}</h3>
          <span
            className="mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
            style={{ backgroundColor: TYPE_COLOR[node.type] }}
          >
            {TYPE_LABEL[node.type]}
          </span>
        </div>
        <button
          onClick={onClose}
          className="rounded-md p-1 text-muted transition hover:bg-canvas hover:text-ink"
          aria-label="Schließen"
        >
          ✕
        </button>
      </div>

      <div className="mt-3">
        <StatusBadge mentionOnly={node.mention_only} />
      </div>

      <div className="mt-3 text-xs text-muted">
        Vorkommen in: {node.documents.map((d) => (
          <span key={d} className="font-mono text-ink">
            {d}{" "}
          </span>
        ))}
      </div>

      <h4 className="mt-4 mb-2 text-xs font-medium text-muted">
        Beziehungen ({links.length})
      </h4>
      <ul className="flex flex-col gap-2">
        {links.map((l, i) => {
          const other = l.source === node.id ? l.target : l.source;
          return (
            <li key={i} className="rounded-lg border border-line bg-canvas p-2.5">
              <div className="text-sm text-ink">
                <span className="text-muted">{l.relation || "verbunden mit"}</span>{" "}
                <span className="font-medium">{nameOf(other)}</span>
              </div>
              {l.evidence_quote && (
                <blockquote className="mt-1 border-l-2 border-accent pl-2 text-xs italic text-muted">
                  „{l.evidence_quote}“
                </blockquote>
              )}
              <div className="mt-1 font-mono text-[10px] text-muted">
                {l.source_document}
                {l.page != null ? ` · S. ${l.page}` : ""}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function StatusBadge({ mentionOnly }: { mentionOnly: boolean }) {
  return mentionOnly ? (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-canvas px-2 py-1 text-[11px] text-muted ring-1 ring-line">
      Nur genannt — keine Schuldzuweisung
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-accent-soft px-2 py-1 text-[11px] text-accent-ink ring-1 ring-accent/30">
      Beleg über bloße Nennung hinaus
    </span>
  );
}
