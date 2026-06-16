import { IBGE_API_V3_BASE_URL, SIDRA_BASE_URL } from "../config.js";
import type { JsonObject } from "../sidra/types.js";

export function summarizeTableDescriptor(
  table: string | number,
  descriptor: JsonObject,
  aggregateMetadata: JsonObject | null,
) {
  const tableId = String(table);
  const variables = extractVariables(descriptor, aggregateMetadata);
  const classifications = extractClassifications(descriptor, aggregateMetadata);

  return {
    table: tableId,
    title: stringValue(descriptor.Nome ?? aggregateMetadata?.nome) ?? `SIDRA table ${tableId}`,
    survey: stringValue(descriptor.Pesquisa ?? aggregateMetadata?.pesquisa),
    subject: stringValue(descriptor.Assunto ?? aggregateMetadata?.assunto),
    periodType:
      stringValue(descriptor.TipoPeriodo) ??
      stringValue((aggregateMetadata?.periodicidade as JsonObject | undefined)?.frequencia),
    availability:
      stringValue(descriptor.PeriodoDisponibilidade) ??
      formatAggregatePeriodicity(aggregateMetadata?.periodicidade),
    territorialLevels: extractTerritorialLevels(descriptor, aggregateMetadata),
    variableCount: variables.total,
    variables: variables.preview,
    classificationCount: classifications.total,
    classifications: classifications.preview,
    sourceUrls: [
      `https://sidra.ibge.gov.br/tabela/${tableId}`,
      `${SIDRA_BASE_URL}/DescritoresTabela/t/${tableId}`,
      `${IBGE_API_V3_BASE_URL}/agregados/${tableId}/metadados`,
    ],
  };
}

function extractVariables(descriptor: JsonObject, aggregateMetadata: JsonObject | null) {
  const rawVariables =
    asArray(descriptor.Variaveis) || asArray(aggregateMetadata?.variaveis) || [];

  return {
    total: rawVariables.length,
    preview: rawVariables.slice(0, 20).map((variable) => {
      const object = asObject(variable);
      return {
        id: stringValue(object?.Id ?? object?.id) ?? "",
        name: stringValue(object?.Nome ?? object?.nome) ?? "",
        unit: stringValue(object?.UnidadeMedida ?? object?.unidade),
      };
    }),
  };
}

function extractClassifications(descriptor: JsonObject, aggregateMetadata: JsonObject | null) {
  const rawClassifications =
    asArray(descriptor.Classificacoes) || asArray(aggregateMetadata?.classificacoes) || [];

  return {
    total:
      numberValue(descriptor.QuantidadeClassificacoes) ??
      rawClassifications.length,
    preview: rawClassifications.slice(0, 20).map((classification) => {
      const object = asObject(classification);
      const categories =
        asArray(object?.Categorias) ||
        asArray(object?.categorias) ||
        asArray(object?.categoria) ||
        [];

      return {
        id: stringValue(object?.Id ?? object?.id) ?? "",
        name: stringValue(object?.Nome ?? object?.nome) ?? "",
        categoryCount: categories.length || null,
      };
    }),
  };
}

function extractTerritorialLevels(
  descriptor: JsonObject,
  aggregateMetadata: JsonObject | null,
): string[] {
  const descriptorLevels = stringValue(descriptor.SiglasNiveisTerritoriais);
  if (descriptorLevels) {
    return descriptorLevels
      .split(",")
      .map((level) => level.trim())
      .filter(Boolean);
  }

  const levelObject = asObject(aggregateMetadata?.nivelTerritorial);
  if (!levelObject) {
    return [];
  }

  return Object.values(levelObject)
    .flatMap((value) => (Array.isArray(value) ? value : []))
    .map(String);
}

function formatAggregatePeriodicity(value: unknown): string | null {
  const periodicity = asObject(value);
  if (!periodicity) {
    return null;
  }

  const frequency = stringValue(periodicity.frequencia);
  const start = stringValue(periodicity.inicio);
  const end = stringValue(periodicity.fim);
  return [frequency, start && end ? `${start} a ${end}` : null].filter(Boolean).join(", ") || null;
}

function asArray(value: unknown): unknown[] | null {
  return Array.isArray(value) ? value : null;
}

function asObject(value: unknown): JsonObject | null {
  return typeof value === "object" && value !== null ? (value as JsonObject) : null;
}

function stringValue(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const text = String(value).trim();
  return text || null;
}

function numberValue(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
