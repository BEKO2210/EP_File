export type EntityType = "person" | "org" | "place";

export interface GraphNode {
  id: string;
  name: string;
  type: EntityType;
  mention_only: boolean;
  degree: number;
  documents: string[];
}

export interface GraphLink {
  source: string;
  target: string;
  relation: string;
  evidence_quote: string;
  page: number | null;
  source_document: string;
}

export interface TimelineEvent {
  date: string;
  description: string;
  source_document: string;
  source_page: number | null;
}

export interface Summary {
  source_document: string;
  summary: string;
}

export interface Dataset {
  generated_at: string;
  disclaimer: string;
  stats: {
    documents: number;
    entities: number;
    relationships: number;
    events: number;
  };
  nodes: GraphNode[];
  links: GraphLink[];
  events: TimelineEvent[];
  summaries: Summary[];
}

export const TYPE_LABEL: Record<EntityType, string> = {
  person: "Person",
  org: "Organisation",
  place: "Ort",
};

export const TYPE_COLOR: Record<EntityType, string> = {
  person: "#0D9488", // teal
  org: "#D97706", // amber
  place: "#475569", // slate
};

export async function loadDataset(): Promise<Dataset> {
  const res = await fetch(`${import.meta.env.BASE_URL}data.json`);
  if (!res.ok) throw new Error(`data.json konnte nicht geladen werden (${res.status})`);
  return res.json();
}
