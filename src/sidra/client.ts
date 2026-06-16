import {
  DEFAULT_REQUEST_TIMEOUT_MS,
  IBGE_API_V3_BASE_URL,
  IBGE_LOCALITIES_BASE_URL,
  SIDRA_BASE_URL,
} from "../config.js";
import {
  buildSidraValuesUrl,
  clampMaxRows,
  normalizeSidraRow,
} from "./query.js";
import type {
  AggregateDataQuery,
  JsonObject,
  LocalitiesQuery,
  SidraValuesQuery,
  SidraValuesResult,
} from "./types.js";

export class IbgeApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly url?: string,
  ) {
    super(message);
    this.name = "IbgeApiError";
  }
}

export class SidraClient {
  constructor(private readonly timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS) {}

  async getTableDescriptor(table: string | number): Promise<JsonObject> {
    const tableId = this.numericId(table, "table");
    return this.getJson<JsonObject>(
      `${SIDRA_BASE_URL}/DescritoresTabela/t/${tableId}`,
    );
  }

  async getAggregateMetadata(aggregate: string | number): Promise<JsonObject> {
    const aggregateId = this.numericId(aggregate, "aggregate");
    return this.getJson<JsonObject>(
      `${IBGE_API_V3_BASE_URL}/agregados/${aggregateId}/metadados`,
    );
  }

  async getAggregatePeriods(aggregate: string | number): Promise<unknown> {
    const aggregateId = this.numericId(aggregate, "aggregate");
    return this.getJson<unknown>(
      `${IBGE_API_V3_BASE_URL}/agregados/${aggregateId}/periodos`,
    );
  }

  async getSidraValues(query: SidraValuesQuery): Promise<SidraValuesResult> {
    const maxRows = clampMaxRows(query.maxRows);
    const { url, dimensionOrder } = buildSidraValuesUrl(query);
    const rawRows = await this.getJson<Array<Record<string, unknown>>>(url);
    const rows = rawRows.slice(0, maxRows).map(normalizeSidraRow);

    return {
      requestUrl: url,
      rowCount: rawRows.length,
      returnedRows: rows.length,
      truncated: rawRows.length > rows.length,
      dimensionOrder,
      rows,
    };
  }

  async getAggregateData(query: AggregateDataQuery): Promise<{
    requestUrl: string;
    itemCount: number;
    returnedItems: number;
    truncated: boolean;
    items: unknown[];
  }> {
    const aggregateId = this.numericId(query.aggregate, "aggregate");
    const variableId = this.numericId(query.variable, "variable");
    const maxItems = clampMaxRows(query.maxItems);
    const url = new URL(
      `${IBGE_API_V3_BASE_URL}/agregados/${aggregateId}/periodos/${encodeURIComponent(
        query.periods,
      )}/variaveis/${variableId}`,
    );

    url.searchParams.set("localidades", query.localities);
    if (query.classification) {
      url.searchParams.set("classificacao", query.classification);
    }
    if (query.view) {
      url.searchParams.set("view", query.view);
    }

    const data = await this.getJson<unknown>(url.toString());
    const items = Array.isArray(data) ? data : [data];

    return {
      requestUrl: url.toString(),
      itemCount: items.length,
      returnedItems: Math.min(items.length, maxItems),
      truncated: items.length > maxItems,
      items: items.slice(0, maxItems),
    };
  }

  async listLocalities(query: LocalitiesQuery): Promise<{
    requestUrl: string;
    itemCount: number;
    items: unknown[];
  }> {
    const url = this.localitiesUrl(query);
    const data = await this.getJson<unknown>(url);
    const items = Array.isArray(data) ? data : [data];

    return {
      requestUrl: url,
      itemCount: items.length,
      items,
    };
  }

  private localitiesUrl(query: LocalitiesQuery): string {
    switch (query.kind) {
      case "regions":
        return `${IBGE_LOCALITIES_BASE_URL}/regioes`;
      case "states":
        return `${IBGE_LOCALITIES_BASE_URL}/estados`;
      case "municipalities":
        return `${IBGE_LOCALITIES_BASE_URL}/municipios`;
      case "state_municipalities":
        return `${IBGE_LOCALITIES_BASE_URL}/estados/${this.numericId(
          query.stateId,
          "stateId",
        )}/municipios`;
      case "municipality":
        return `${IBGE_LOCALITIES_BASE_URL}/municipios/${this.numericId(
          query.municipalityId,
          "municipalityId",
        )}`;
      default:
        return assertNever(query);
    }
  }

  private numericId(value: string | number, label: string): string {
    const normalized = String(value).trim();
    if (!/^\d+$/.test(normalized)) {
      throw new Error(`${label} must be numeric.`);
    }
    return normalized;
  }

  private async getJson<T>(url: string): Promise<T> {
    const timeoutSignal = AbortSignal.timeout(this.timeoutMs);
    let response: Response;

    try {
      response = await fetch(url, {
        headers: {
          accept: "application/json",
          "user-agent": "mcp-sidra/0.1.0",
        },
        signal: timeoutSignal,
      });
    } catch (error) {
      throw new IbgeApiError(
        `Failed to request IBGE API: ${String(error)}`,
        undefined,
        url,
      );
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new IbgeApiError(
        `IBGE API returned ${response.status}: ${body.slice(0, 300)}`,
        response.status,
        url,
      );
    }

    return (await response.json()) as T;
  }
}

function assertNever(value: never): never {
  throw new Error(`Unexpected locality query: ${JSON.stringify(value)}`);
}
