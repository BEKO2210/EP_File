import { TimelineEvent } from "../lib/data";

interface Props {
  events: TimelineEvent[];
}

export default function TimelineView({ events }: Props) {
  if (events.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted">
        Keine Ereignisse für die aktuellen Filter.
      </div>
    );
  }

  return (
    <div className="mx-auto h-full max-w-3xl overflow-auto px-6 py-8">
      <ol className="relative border-l border-line pl-6">
        {events.map((ev, i) => (
          <li key={i} className="mb-8 last:mb-0">
            <span className="absolute -left-[7px] mt-1.5 h-3.5 w-3.5 rounded-full border-2 border-surface bg-accent" />
            <time className="font-mono text-xs font-medium text-accent">
              {formatDate(ev.date)}
            </time>
            <p className="mt-1 text-sm leading-relaxed text-ink">{ev.description}</p>
            <div className="mt-1 font-mono text-[11px] text-muted">
              {ev.source_document}
              {ev.source_page != null ? ` · S. ${ev.source_page}` : ""}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function formatDate(raw: string): string {
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleDateString("de-DE", { year: "numeric", month: "long", day: "numeric" });
}
