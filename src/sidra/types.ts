export type JsonObject = Record<string, unknown>;

export type SidraGeography = {
  level: string;
  localities: string;
};

export type SidraClassification = {
  id: string | number;
  categories: string;
};

export type SidraValuesQuery = {
  table: string | number;
  periods?: string;
  variables?: string;
  geographies?: SidraGeography[];
  classifications?: SidraClassification[];
  fieldFormat?: "a" | "c" | "n" | "u";
  decimals?: "s" | "m" | "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";
  includeHeader?: boolean;
  maxRows?: number;
};

export type AggregateDataQuery = {
  aggregate: string | number;
  periods: string;
  variable: string | number;
  localities: string;
  classification?: string;
  view?: string;
  maxItems?: number;
};

export type LocalitiesQuery =
  | { kind: "regions" }
  | { kind: "states" }
  | { kind: "municipalities" }
  | { kind: "state_municipalities"; stateId: string | number }
  | { kind: "municipality"; municipalityId: string | number };

export type NormalizedSidraRow = {
  value: string | null;
  numericValue: number | null;
  valueStatus: string | null;
  unit: string | null;
  territorialLevel: string | null;
  territory: string | null;
  dimensions: Array<{
    position: number;
    code: string | null;
    name: string | null;
  }>;
};

export type SidraValuesResult = {
  requestUrl: string;
  rowCount: number;
  returnedRows: number;
  truncated: boolean;
  dimensionOrder: string[];
  rows: NormalizedSidraRow[];
};
