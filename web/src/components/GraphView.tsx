import { useEffect, useMemo, useRef, useState } from "react";
import { Dataset, GraphLink, GraphNode, TYPE_COLOR, TYPE_LABEL } from "../lib/data";

interface Props {
  nodes: GraphNode[];
  links: GraphLink[];
  data: Dataset;
}

const W = 1000;
const H = 700;

interface Pt {
  x: number;
  y: number;
}

/** Kompakte, abhängigkeitsfreie Kräfte-Layout-Berechnung (Fruchterman–Reingold). */
function computeLayout(nodes: GraphNode[], links: GraphLink[]): Map<string, Pt> {
  const pos = new Map<string, Pt>();
  const n = nodes.length;
  if (n === 0) return pos;
  const R = Math.min(W, H) * 0.32;
  nodes.forEach((node, i) => {
    const a = (i / n) * 2 * Math.PI;
    pos.set(node.id, {
      x: W / 2 + Math.cos(a) * R + (Math.random() - 0.5) * 12,
      y: H / 2 + Math.sin(a) * R + (Math.random() - 0.5) * 12,
    });
  });
  const ids = new Set(nodes.map((x) => x.id));
  const edges = links.filter((l) => ids.has(l.source) && ids.has(l.target));
  const k = Math.sqrt((W * H) / n) * 0.55;
  const iterations = n > 200 ? 120 : 300;

  for (let it = 0; it < iterations; it++) {
    const disp = new Map<string, Pt>(nodes.map((x) => [x.id, { x: 0, y: 0 }]));

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = pos.get(nodes[i].id)!;
        const b = pos.get(nodes[j].id)!;
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        const d = Math.hypot(dx, dy) || 0.01;
        const f = (k * k) / d;
        const ux = dx / d;
        const uy = dy / d;
        const di = disp.get(nodes[i].id)!;
        const dj = disp.get(nodes[j].id)!;
        di.x += ux * f;
        di.y += uy * f;
        dj.x -= ux * f;
        dj.y -= uy * f;
      }
    }

    for (const e of edges) {
      const a = pos.get(e.source)!;
      const b = pos.get(e.target)!;
      let dx = a.x - b.x;
      let dy = a.y - b.y;
      const d = Math.hypot(dx, dy) || 0.01;
      const f = (d * d) / k;
      const ux = dx / d;
      const uy = dy / d;
      const ds = disp.get(e.source)!;
      const dt = disp.get(e.target)!;
      ds.x -= ux * f;
      ds.y -= uy * f;
      dt.x += ux * f;
      dt.y += uy * f;
    }

    const temp = (1 - it / iterations) * (Math.min(W, H) * 0.1);
    for (const node of nodes) {
      const dp = disp.get(node.id)!;
      const p = pos.get(node.id)!;
      dp.x += (W / 2 - p.x) * 0.012;
      dp.y += (H / 2 - p.y) * 0.012;
      const dl = Math.hypot(dp.x, dp.y) || 0.01;
      p.x += (dp.x / dl) * Math.min(dl, temp);
      p.y += (dp.y / dl) * Math.min(dl, temp);
      p.x = Math.max(24, Math.min(W - 24, p.x));
      p.y = Math.max(24, Math.min(H - 24, p.y));
    }
  }
  return pos;
}

export default function GraphView({ nodes, links, data }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState({ k: 1, x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Wheel-Zoom über einen NICHT-passiven Listener, damit preventDefault erlaubt
  // ist (React-onWheel ist passiv → "Unable to preventDefault" + kein Zoom).
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      setView((v) => ({ ...v, k: Math.max(0.3, Math.min(4, v.k * factor)) }));
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  const pos = useMemo(() => computeLayout(nodes, links), [nodes, links]);
  const visibleIds = useMemo(() => new Set(nodes.map((n) => n.id)), [nodes]);
  const edges = useMemo(
    () => links.filter((l) => visibleIds.has(l.source) && visibleIds.has(l.target)),
    [links, visibleIds],
  );

  const selectedNode = nodes.find((n) => n.id === selected) ?? null;
  const selectedLinks = useMemo(
    () => (selected ? data.links.filter((l) => l.source === selected || l.target === selected) : []),
    [selected, data.links],
  );

  if (nodes.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted">
        Keine Entitäten für die aktuellen Filter.
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      <svg
        ref={svgRef}
        className="h-full w-full touch-none cursor-grab active:cursor-grabbing"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        onPointerDown={(e) => {
          drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          setView((v) => ({
            ...v,
            x: drag.current!.vx + (e.clientX - drag.current!.x),
            y: drag.current!.vy + (e.clientY - drag.current!.y),
          }));
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerLeave={() => (drag.current = null)}
      >
        <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
          {edges.map((e, i) => {
            const a = pos.get(e.source);
            const b = pos.get(e.target);
            if (!a || !b) return null;
            const active = selected === e.source || selected === e.target;
            return (
              <line
                key={i}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={active ? "#0D9488" : "#D4D4D8"}
                strokeWidth={active ? 2 : 1}
                opacity={selected && !active ? 0.25 : 0.8}
              />
            );
          })}
          {nodes.map((node) => {
            const p = pos.get(node.id);
            if (!p) return null;
            const r = 7 + Math.min(node.degree, 12) * 1.6;
            const dim = selected && selected !== node.id && !selectedLinks.some(
              (l) => l.source === node.id || l.target === node.id,
            );
            return (
              <g
                key={node.id}
                transform={`translate(${p.x} ${p.y})`}
                className="cursor-pointer"
                opacity={dim ? 0.3 : 1}
                onClick={(ev) => {
                  ev.stopPropagation();
                  setSelected(node.id);
                }}
              >
                <circle
                  r={r}
                  fill={TYPE_COLOR[node.type]}
                  stroke={node.mention_only ? "#FFFFFF" : "#134E4A"}
                  strokeWidth={node.mention_only ? 1.5 : 2.5}
                  strokeDasharray={node.mention_only ? "3 2" : undefined}
                />
                <text
                  x={r + 4}
                  y={4}
                  fontSize={12}
                  fill="#27272A"
                  className="pointer-events-none select-none"
                >
                  {node.name}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      <Legend />
      <ZoomControls onZoom={(f) => setView((v) => ({ ...v, k: Math.max(0.3, Math.min(4, v.k * f)) }))} onReset={() => setView({ k: 1, x: 0, y: 0 })} />

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
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: TYPE_COLOR[t] }} />
          {TYPE_LABEL[t]}
        </span>
      ))}
      <span className="flex items-center gap-1.5 text-muted">
        <span className="inline-block h-2.5 w-2.5 rounded-full border border-dashed border-zinc-400" />
        nur genannt
      </span>
    </div>
  );
}

function ZoomControls({ onZoom, onReset }: { onZoom: (f: number) => void; onReset: () => void }) {
  return (
    <div className="absolute bottom-4 right-4 flex flex-col gap-1">
      {[
        ["+", () => onZoom(1.2)],
        ["−", () => onZoom(1 / 1.2)],
        ["⟲", onReset],
      ].map(([label, fn], i) => (
        <button
          key={i}
          onClick={fn as () => void}
          className="h-8 w-8 rounded-lg border border-line bg-surface text-ink shadow-card transition hover:bg-canvas"
        >
          {label as string}
        </button>
      ))}
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
    <div className="absolute right-4 top-4 max-h-[calc(100%-2rem)] w-[min(20rem,85vw)] overflow-auto rounded-xl border border-line bg-surface p-4 shadow-card">
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
        {node.mention_only ? (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-canvas px-2 py-1 text-[11px] text-muted ring-1 ring-line">
            Nur genannt — keine Schuldzuweisung
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-accent-soft px-2 py-1 text-[11px] text-accent-ink ring-1 ring-accent/30">
            Beleg über bloße Nennung hinaus
          </span>
        )}
      </div>

      <div className="mt-3 text-xs text-muted">
        Vorkommen in:{" "}
        {node.documents.map((d) => (
          <span key={d} className="font-mono text-ink">
            {d}{" "}
          </span>
        ))}
      </div>

      <h4 className="mb-2 mt-4 text-xs font-medium text-muted">Beziehungen ({links.length})</h4>
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
