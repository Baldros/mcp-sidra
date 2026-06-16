import { z } from "zod";

export const searchInputSchema = {
  query: z.string().min(1).describe("Search query in Portuguese or English."),
};

export const searchOutputSchema = {
  results: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      url: z.string().url(),
    }),
  ),
};

export const fetchInputSchema = {
  id: z.string().min(1).describe("Document or search result id returned by search."),
};

export const fetchOutputSchema = {
  id: z.string(),
  title: z.string(),
  text: z.string(),
  url: z.string().url(),
  metadata: z.record(z.string(), z.string()).optional(),
};

export const describeTableInputSchema = {
  table: z.union([z.string(), z.number()]).describe("SIDRA table / aggregate id, for example 1612."),
};

export const describeTableOutputSchema = {
  table: z.string(),
  title: z.string(),
  survey: z.string().nullable(),
  subject: z.string().nullable(),
  periodType: z.string().nullable(),
  availability: z.string().nullable(),
  territorialLevels: z.array(z.string()),
  variableCount: z.number(),
  variables: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      unit: z.string().nullable(),
    }),
  ),
  classificationCount: z.number(),
  classifications: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      categoryCount: z.number().nullable(),
    }),
  ),
  sourceUrls: z.array(z.string().url()),
};

export const sidraValuesInputSchema = {
  table: z.union([z.string(), z.number()]).describe("SIDRA table id, for example 1612."),
  periods: z
    .string()
    .default("last")
    .describe("SIDRA period selector, for example 2021, 2019,2020,2021, 2010-2021, last, or last 12."),
  variables: z
    .string()
    .default("allxp")
    .describe("SIDRA variable selector, for example 214, 63,69, all, or allxp."),
  geographies: z
    .array(
      z.object({
        level: z.string().describe("SIDRA geographic level such as n1, n2, n3, or n6."),
        localities: z
          .string()
          .describe("Locality selector such as 1, all, 35, 3304557, or 'in n3 35'."),
      }),
    )
    .default([{ level: "n1", localities: "1" }]),
  classifications: z
    .array(
      z.object({
        id: z.union([z.string(), z.number()]),
        categories: z.string().describe("Category selector such as 2702, all, allxt, or 2692,2702."),
      }),
    )
    .default([]),
  fieldFormat: z.enum(["a", "c", "n", "u"]).default("n"),
  decimals: z.enum(["s", "m", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]).default("s"),
  includeHeader: z.boolean().default(false),
  maxRows: z.number().int().min(1).max(5000).default(1000),
};

export const sidraValuesOutputSchema = {
  requestUrl: z.string().url(),
  rowCount: z.number(),
  returnedRows: z.number(),
  truncated: z.boolean(),
  dimensionOrder: z.array(z.string()),
  rows: z.array(
    z.object({
      value: z.string().nullable(),
      numericValue: z.number().nullable(),
      valueStatus: z.string().nullable(),
      unit: z.string().nullable(),
      territorialLevel: z.string().nullable(),
      territory: z.string().nullable(),
      dimensions: z.array(
        z.object({
          position: z.number(),
          code: z.string().nullable(),
          name: z.string().nullable(),
        }),
      ),
    }),
  ),
};

export const aggregateDataInputSchema = {
  aggregate: z.union([z.string(), z.number()]).describe("IBGE aggregate / SIDRA table id."),
  periods: z.string().describe("Period selector for the Aggregates API, for example 2021 or last."),
  variable: z.union([z.string(), z.number()]).describe("Variable id."),
  localities: z.string().describe("Aggregates API locality selector, for example N1[1] or N3[35]."),
  classification: z
    .string()
    .optional()
    .describe("Optional classification selector, for example 81[2702]."),
  view: z.string().optional().describe("Optional IBGE API view parameter."),
  maxItems: z.number().int().min(1).max(5000).default(1000),
};

export const aggregateDataOutputSchema = {
  requestUrl: z.string().url(),
  itemCount: z.number(),
  returnedItems: z.number(),
  truncated: z.boolean(),
  items: z.array(z.unknown()),
};

export const localitiesInputSchema = {
  kind: z.enum([
    "regions",
    "states",
    "municipalities",
    "state_municipalities",
    "municipality",
  ]),
  stateId: z.union([z.string(), z.number()]).optional(),
  municipalityId: z.union([z.string(), z.number()]).optional(),
};

export const localitiesOutputSchema = {
  requestUrl: z.string().url(),
  itemCount: z.number(),
  items: z.array(z.unknown()),
};
