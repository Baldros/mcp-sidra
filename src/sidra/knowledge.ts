import { IBGE_API_V3_BASE_URL, IBGE_LOCALITIES_BASE_URL, SIDRA_BASE_URL } from "../config.js";
import { SidraClient } from "./client.js";

export type KnowledgeSearchResult = {
  id: string;
  title: string;
  url: string;
};

export type KnowledgeDocument = KnowledgeSearchResult & {
  text: string;
  metadata?: Record<string, string>;
};

const STATIC_DOCUMENTS: KnowledgeDocument[] = [
  {
    id: "sidra-overview",
    title: "SIDRA API overview",
    url: `${SIDRA_BASE_URL}/home`,
    text:
      "SIDRA is the IBGE system for retrieving multidimensional statistical tables. " +
      "Every table can be queried by dimensions such as period, variable, geography, classification, and category. " +
      "Public SIDRA and IBGE service APIs do not require authentication for ordinary public data queries.",
    metadata: { source: "IBGE SIDRA" },
  },
  {
    id: "sidra-values",
    title: "SIDRA /values endpoint",
    url: `${SIDRA_BASE_URL}/home/ajuda`,
    text:
      "The SIDRA /values endpoint retrieves data values. A typical path looks like " +
      "/values/t/{table}/n{level}/{localities}/v/{variables}/p/{periods}/c{classification}/{categories}. " +
      "The query limit is 100,000 values, so large extracts should be split by period, geography, variable, or category. " +
      "Values are returned as strings and may include official special symbols such as X, .., ..., and -.",
    metadata: { source: "IBGE SIDRA" },
  },
  {
    id: "sidra-descriptor",
    title: "SIDRA table descriptor endpoint",
    url: `${SIDRA_BASE_URL}/DescritoresTabela/t/{table}`,
    text:
      "The SIDRA table descriptor endpoint returns table metadata including name, survey, subject, variables, periods, territorial levels, classifications, and categories. " +
      "Use it before dynamically building /values queries so the model can choose valid dimensions.",
    metadata: { source: "IBGE SIDRA" },
  },
  {
    id: "ibge-aggregates-v3",
    title: "IBGE Aggregates API v3",
    url: `${IBGE_API_V3_BASE_URL}/agregados`,
    text:
      "The IBGE Aggregates API v3 is a standardized API surface for aggregates that correspond to SIDRA tables. " +
      "Important endpoints include /agregados, /agregados/{aggregate}/metadados, /agregados/{aggregate}/periodos, " +
      "and /agregados/{aggregate}/periodos/{periods}/variaveis/{variable}. Data queries require a localidades selector such as N1[1].",
    metadata: { source: "IBGE Serviço de Dados" },
  },
  {
    id: "ibge-localities-v1",
    title: "IBGE Localities API v1",
    url: IBGE_LOCALITIES_BASE_URL,
    text:
      "The IBGE Localities API resolves official Brazilian territorial identifiers and administrative hierarchy metadata. " +
      "Use it to list regions, states, municipalities, and municipality details before querying SIDRA by geographic level.",
    metadata: { source: "IBGE Serviço de Dados" },
  },
];

export function searchKnowledge(query: string): KnowledgeSearchResult[] {
  const normalized = query.trim().toLowerCase();
  const results = new Map<string, KnowledgeSearchResult>();

  for (const tableId of extractTableIds(query)) {
    results.set(`sidra-table-${tableId}`, {
      id: `sidra-table-${tableId}`,
      title: `SIDRA table ${tableId}`,
      url: `https://sidra.ibge.gov.br/tabela/${tableId}`,
    });
  }

  for (const document of STATIC_DOCUMENTS) {
    const haystack = `${document.title}\n${document.text}`.toLowerCase();
    if (!normalized || normalized.split(/\s+/).some((term) => haystack.includes(term))) {
      results.set(document.id, {
        id: document.id,
        title: document.title,
        url: document.url,
      });
    }
  }

  return [...results.values()].slice(0, 10);
}

export async function fetchKnowledgeDocument(
  id: string,
  client = new SidraClient(),
): Promise<KnowledgeDocument> {
  const staticDocument = STATIC_DOCUMENTS.find((document) => document.id === id);
  if (staticDocument) {
    return staticDocument;
  }

  const tableMatch = /^sidra-table-(\d+)$/.exec(id);
  if (tableMatch) {
    const tableId = tableMatch[1];
    const descriptor = await client.getTableDescriptor(tableId);
    const variables = Array.isArray(descriptor.Variaveis)
      ? descriptor.Variaveis.slice(0, 12).map((variable) =>
          typeof variable === "object" && variable !== null
            ? `${String((variable as Record<string, unknown>).Id ?? "")}: ${String(
                (variable as Record<string, unknown>).Nome ?? "",
              )}`
            : String(variable),
        )
      : [];

    return {
      id,
      title: `SIDRA table ${tableId}: ${String(descriptor.Nome ?? "metadata")}`,
      url: `https://sidra.ibge.gov.br/tabela/${tableId}`,
      text: [
        `Table: ${tableId}`,
        `Name: ${String(descriptor.Nome ?? "")}`,
        `Survey: ${String(descriptor.Pesquisa ?? "")}`,
        `Subject: ${String(descriptor.Assunto ?? "")}`,
        `Period type: ${String(descriptor.TipoPeriodo ?? "")}`,
        `Availability: ${String(descriptor.PeriodoDisponibilidade ?? "")}`,
        `Territorial levels: ${String(descriptor.SiglasNiveisTerritoriais ?? "")}`,
        variables.length ? `Variables: ${variables.join("; ")}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
      metadata: { source: "IBGE SIDRA", table: tableId },
    };
  }

  throw new Error(`Knowledge document not found: ${id}`);
}

function extractTableIds(query: string): string[] {
  const ids = new Set<string>();
  for (const match of query.matchAll(/\b(?:tabela|table|agregado|aggregate)?\s*(\d{2,7})\b/gi)) {
    ids.add(match[1]);
  }
  return [...ids].slice(0, 5);
}
