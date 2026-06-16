import { describe, expect, it } from "vitest";
import {
  buildSidraValuesUrl,
  normalizeSidraRow,
  parseSidraNumericValue,
} from "../src/sidra/query.js";

describe("buildSidraValuesUrl", () => {
  it("builds a default SIDRA values URL", () => {
    const result = buildSidraValuesUrl({ table: 1612 });

    expect(result.url).toBe(
      "https://apisidra.ibge.gov.br/values/t/1612/n1/1/p/last/v/allxp/f/n/d/s/h/n?formato=json",
    );
    expect(result.dimensionOrder).toEqual(["n1", "p", "v"]);
  });

  it("encodes nested geography selectors", () => {
    const result = buildSidraValuesUrl({
      table: 1612,
      periods: "2021",
      variables: "214",
      geographies: [{ level: "n6", localities: "in n3 35" }],
      classifications: [{ id: 81, categories: "2702" }],
    });

    expect(result.url).toContain("/n6/in%20n3%2035/");
    expect(result.url).toContain("/c81/2702/");
    expect(result.dimensionOrder).toEqual(["n6", "c81", "p", "v"]);
  });
});

describe("parseSidraNumericValue", () => {
  it("parses Brazilian decimal values", () => {
    expect(parseSidraNumericValue("1.234,56")).toEqual({
      numericValue: 1234.56,
      valueStatus: null,
    });
  });

  it("keeps official special symbols as statuses", () => {
    expect(parseSidraNumericValue("...")).toEqual({
      numericValue: null,
      valueStatus: "not_available",
    });
  });
});

describe("normalizeSidraRow", () => {
  it("normalizes dimension fields in order", () => {
    const row = normalizeSidraRow({
      V: "2900805",
      MN: "Toneladas",
      NN: "Brasil",
      D2N: "Quantidade produzida",
      D1N: "Brasil",
      D3N: "2021",
    });

    expect(row.numericValue).toBe(2900805);
    expect(row.unit).toBe("Toneladas");
    expect(row.dimensions.map((dimension) => dimension.name)).toEqual([
      "Brasil",
      "Quantidade produzida",
      "2021",
    ]);
  });
});
