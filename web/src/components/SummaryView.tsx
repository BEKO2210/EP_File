import { Summary } from "../lib/data";

interface Props {
  summaries: Summary[];
}

export default function SummaryView({ summaries }: Props) {
  if (summaries.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted">
        Keine Zusammenfassungen für die aktuellen Filter.
      </div>
    );
  }

  return (
    <div className="mx-auto h-full max-w-4xl overflow-auto px-6 py-8">
      <div className="grid gap-4 md:grid-cols-2">
        {summaries.map((s) => (
          <article
            key={s.source_document}
            className="rounded-xl border border-line bg-surface p-5 shadow-card"
          >
            <h3 className="mb-2 font-mono text-xs font-medium text-accent">
              {s.source_document}
            </h3>
            <p className="text-sm leading-relaxed text-ink">{s.summary}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
