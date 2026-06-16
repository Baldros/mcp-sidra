import {
  DEFAULT_MAX_ROWS,
  HARD_MAX_ROWS,
  SIDRA_BASE_URL,
} from "../config.js";
import type {
  NormalizedSidraRow,
  SidraValuesQuery,
} from "./types.js";

const SPECIAL_VALUE_STATUSES: Record<string, string> = {
  "-": "absolute_zero",
  X: "inhibited",
  "..": "not_applicable",
  "...": "not_available",
};

function normalizeIdentifier(value: string | number, label: string): string {
  const normalized = String(value).trim();
  if (!/^\d+$/.test(normalized)) {
    throw new Error(`${label} must be numeric.`);
  }
  return normalized;
}

function normalizeSelector(value: string | number, label: string): string {
  const normalized = String(value).trim();
  if (!normalized) {
    throw new Error(`${label} cannot be empty.`);
  }
  if (normalized.includes("/")) {
    throw new Error(`${label} cannot contain '/'.`);
  }
  return normalized;
}

function normalizeLevel(level: string): string {
  const normalized = level.trim().toLowerCase();
  if (/^\d+$/.test(normalized)) {
    return `n${normalized}`;
  }
  if (!/^n\d+$/.test(normalized)) {
    throw new Error("Geographic level must look like n1, n2, n3, n6, etc.");
  }
  return normalized;
}

function pushPair(parts: string[], key: string, value: string | number): void {
  parts.push(key, encodeURIComponent(normalizeSelector(value, key)));
}

export function clampMaxRows(maxRows?: number): number {
  if (maxRows === undefined) {
    return DEFAULT_MAX_ROWS;
  }
  if (!Number.isInteger(maxRows) || maxRows < 1) {
    throw new Error("maxRows must be a positive integer.");
  }
  return Math.min(maxRows, HARD_MAX_ROWS);
}

export function buildSidraValuesUrl(query: SidraValuesQuery): {
  url: string;
  dimensionOrder: string[];
} {
  const table = normalizeIdentifier(query.table, "table");
  const geographies = query.geographies?.length
    ? query.geographies
    : [{ level: "n1", localities: "1" }];
  const periods = query.periods ?? "last";
  const variables = query.variables ?? "allxp";
  const fieldFormat = query.fieldFormat ?? "n";
  const decimals = query.decimals ?? "s";
  const includeHeader = query.includeHeader ?? false;

  const parts = ["values", "t", table];
  const dimensionOrder: string[] = [];

  for (const geography of geographies) {
    const level = normalizeLevel(geography.level);
    pushPair(parts, level, geography.localities);
    dimensionOrder.push(level);
  }

  for (const classification of query.classifications ?? []) {
    const id = normalizeIdentifier(classification.id, "classification id");
    pushPair(parts, `c${id}`, classification.categories);
    dimensionOrder.push(`c${id}`);
  }

  pushPair(parts, "p", periods);
  dimensionOrder.push("p");
  pushPair(parts, "v", variables);
  dimensionOrder.push("v");
  pushPair(parts, "f", fieldFormat);
  pushPair(parts, "d", decimals);
  pushPair(parts, "h", includeHeader ? "y" : "n");

  return {
    url: `${SIDRA_BASE_URL}/${parts.join("/")}?formato=json`,
    dimensionOrder,
  };
}

export function parseSidraNumericValue(value: unknown): {
  numericValue: number | null;
  valueStatus: string | null;
} {
  if (value === null || value === undefined) {
    return { numericValue: null, valueStatus: "missing" };
  }

  const text = String(value).trim();
  if (text in SPECIAL_VALUE_STATUSES) {
    return { numericValue: null, valueStatus: SPECIAL_VALUE_STATUSES[text] };
  }

  const normalized = text.replace(/\./g, "").replace(",", ".");
  const numericValue = Number(normalized);
  if (Number.isFinite(numericValue)) {
    return { numericValue, valueStatus: null };
  }

  return { numericValue: null, valueStatus: "non_numeric" };
}

export function normalizeSidraRow(row: Record<string, unknown>): NormalizedSidraRow {
  const value = row.V === undefined || row.V === null ? null : String(row.V);
  const { numericValue, valueStatus } = parseSidraNumericValue(value);
  const dimensions: NormalizedSidraRow["dimensions"] = [];

  for (const [key, rawValue] of Object.entries(row)) {
    const match = /^D(\d+)N$/.exec(key);
    if (!match) {
      continue;
    }
    const position = Number(match[1]);
    const code = row[`D${position}C`];
    dimensions.push({
      position,
      code: code === undefined || code === null ? null : String(code),
      name: rawValue === undefined || rawValue === null ? null : String(rawValue),
    });
  }

  dimensions.sort((a, b) => a.position - b.position);

  return {
    value,
    numericValue,
    valueStatus,
    unit: row.MN === undefined || row.MN === null ? null : String(row.MN),
    territorialLevel:
      row.NC === undefined || row.NC === null ? null : String(row.NC),
    territory: row.NN === undefined || row.NN === null ? null : String(row.NN),
    dimensions,
  };
}
