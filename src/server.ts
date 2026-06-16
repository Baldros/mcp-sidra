import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { join } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  RESOURCE_MIME_TYPE,
  registerAppResource,
  registerAppTool,
} from "@modelcontextprotocol/ext-apps/server";
import { DEFAULT_PORT, MCP_PATH } from "./config.js";
import {
  aggregateDataInputSchema,
  aggregateDataOutputSchema,
  describeTableInputSchema,
  describeTableOutputSchema,
  fetchInputSchema,
  fetchOutputSchema,
  localitiesInputSchema,
  localitiesOutputSchema,
  searchInputSchema,
  searchOutputSchema,
  sidraValuesInputSchema,
  sidraValuesOutputSchema,
} from "./mcp/schemas.js";
import { summarizeTableDescriptor } from "./mcp/table-summary.js";
import { SidraClient } from "./sidra/client.js";
import { fetchKnowledgeDocument, searchKnowledge } from "./sidra/knowledge.js";
import type { LocalitiesQuery } from "./sidra/types.js";

const widgetHtml = readFileSync(
  join(process.cwd(), "public", "sidra-widget.html"),
  "utf8",
);

const client = new SidraClient();
const WIDGET_URI = "ui://widget/sidra-results-v1.html";

function jsonContent(value: unknown) {
  return [{ type: "text" as const, text: JSON.stringify(value) }];
}

function createSidraServer() {
  const server = new McpServer(
    { name: "mcp-sidra", version: "0.1.0" },
    {
      instructions:
        "Use este servidor para consultar dados publicos do IBGE/SIDRA. Todas as ferramentas sao somente leitura. Para consultas SIDRA, prefira describe_table antes de montar get_sidra_values quando a tabela, variavel ou classificacao nao estiver clara. Preserve URLs de fonte nas respostas.",
    },
  );

  registerAppResource(
    server,
    "sidra-results",
    WIDGET_URI,
    {},
    async () => ({
      contents: [
        {
          uri: WIDGET_URI,
          mimeType: RESOURCE_MIME_TYPE,
          text: widgetHtml,
          _meta: {
            ui: {
              prefersBorder: true,
              csp: {
                connectDomains: [],
                resourceDomains: [],
              },
              ...(process.env.APP_DOMAIN ? { domain: process.env.APP_DOMAIN } : {}),
            },
            "openai/widgetDescription":
              "Mostra resultados tabulares de consultas publicas ao IBGE/SIDRA.",
          },
        },
      ],
    }),
  );

  server.registerTool(
    "search",
    {
      title: "Search IBGE SIDRA knowledge",
      description:
        "Searches public IBGE/SIDRA API documentation and table references. Use fetch to retrieve the selected result.",
      inputSchema: searchInputSchema,
      outputSchema: searchOutputSchema,
      annotations: { readOnlyHint: true },
    },
    async ({ query }) => {
      const structuredContent = { results: searchKnowledge(query) };
      return {
        structuredContent,
        content: jsonContent(structuredContent),
      };
    },
  );

  server.registerTool(
    "fetch",
    {
      title: "Fetch IBGE SIDRA knowledge item",
      description:
        "Fetches a public IBGE/SIDRA knowledge item returned by search, including a canonical URL for citation.",
      inputSchema: fetchInputSchema,
      outputSchema: fetchOutputSchema,
      annotations: { readOnlyHint: true },
    },
    async ({ id }) => {
      const structuredContent = await fetchKnowledgeDocument(id, client);
      return {
        structuredContent,
        content: jsonContent(structuredContent),
      };
    },
  );

  registerAppTool(
    server,
    "describe_table",
    {
      title: "Describe SIDRA table",
      description:
        "Gets public metadata for a SIDRA table / IBGE aggregate: title, survey, period availability, variables, classifications, and source URLs.",
      inputSchema: describeTableInputSchema,
      outputSchema: describeTableOutputSchema,
      annotations: { readOnlyHint: true },
      _meta: {
        ui: { resourceUri: WIDGET_URI },
        "openai/toolInvocation/invoking": "Consultando metadados SIDRA...",
        "openai/toolInvocation/invoked": "Metadados SIDRA prontos.",
      },
    },
    async ({ table }) => {
      const descriptor = await client.getTableDescriptor(table);
      let aggregateMetadata = null;
      try {
        aggregateMetadata = await client.getAggregateMetadata(table);
      } catch {
        aggregateMetadata = null;
      }
      const structuredContent = summarizeTableDescriptor(table, descriptor, aggregateMetadata);
      return {
        structuredContent,
        content: [
          {
            type: "text",
            text: `Tabela ${structuredContent.table}: ${structuredContent.title}`,
          },
        ],
      };
    },
  );

  registerAppTool(
    server,
    "get_sidra_values",
    {
      title: "Get SIDRA values",
      description:
        "Retrieves public values from the legacy SIDRA /values endpoint with normalized rows and the request URL.",
      inputSchema: sidraValuesInputSchema,
      outputSchema: sidraValuesOutputSchema,
      annotations: { readOnlyHint: true },
      _meta: {
        ui: { resourceUri: WIDGET_URI },
        "openai/toolInvocation/invoking": "Buscando valores SIDRA...",
        "openai/toolInvocation/invoked": "Valores SIDRA prontos.",
      },
    },
    async (args) => {
      const structuredContent = await client.getSidraValues(args);
      return {
        structuredContent,
        content: [
          {
            type: "text",
            text: `Recuperadas ${structuredContent.returnedRows} de ${structuredContent.rowCount} linhas SIDRA. URL: ${structuredContent.requestUrl}`,
          },
        ],
      };
    },
  );

  registerAppTool(
    server,
    "get_aggregate_data",
    {
      title: "Get IBGE aggregate data",
      description:
        "Retrieves public data from the IBGE Aggregates API v3 using aggregate, periods, variable, localities, and optional classification selectors.",
      inputSchema: aggregateDataInputSchema,
      outputSchema: aggregateDataOutputSchema,
      annotations: { readOnlyHint: true },
      _meta: {
        ui: { resourceUri: WIDGET_URI },
        "openai/toolInvocation/invoking": "Consultando API de Agregados IBGE...",
        "openai/toolInvocation/invoked": "Agregado IBGE pronto.",
      },
    },
    async (args) => {
      const structuredContent = await client.getAggregateData(args);
      return {
        structuredContent,
        content: [
          {
            type: "text",
            text: `Recuperados ${structuredContent.returnedItems} de ${structuredContent.itemCount} itens. URL: ${structuredContent.requestUrl}`,
          },
        ],
      };
    },
  );

  registerAppTool(
    server,
    "list_localities",
    {
      title: "List IBGE localities",
      description:
        "Lists public IBGE localities such as regions, states, municipalities, municipalities in a state, or a municipality by id.",
      inputSchema: localitiesInputSchema,
      outputSchema: localitiesOutputSchema,
      annotations: { readOnlyHint: true },
      _meta: {
        ui: { resourceUri: WIDGET_URI },
        "openai/toolInvocation/invoking": "Listando localidades IBGE...",
        "openai/toolInvocation/invoked": "Localidades IBGE prontas.",
      },
    },
    async (args) => {
      const query = toLocalitiesQuery(args);
      const structuredContent = await client.listLocalities(query);
      return {
        structuredContent,
        content: [
          {
            type: "text",
            text: `Recuperados ${structuredContent.itemCount} itens de localidades IBGE. URL: ${structuredContent.requestUrl}`,
          },
        ],
      };
    },
  );

  return server;
}

function toLocalitiesQuery(args: {
  kind: string;
  stateId?: string | number;
  municipalityId?: string | number;
}): LocalitiesQuery {
  switch (args.kind) {
    case "regions":
    case "states":
    case "municipalities":
      return { kind: args.kind };
    case "state_municipalities":
      if (args.stateId === undefined) {
        throw new Error("stateId is required when kind is state_municipalities.");
      }
      return { kind: "state_municipalities", stateId: args.stateId };
    case "municipality":
      if (args.municipalityId === undefined) {
        throw new Error("municipalityId is required when kind is municipality.");
      }
      return { kind: "municipality", municipalityId: args.municipalityId };
    default:
      throw new Error(`Unsupported localities kind: ${args.kind}`);
  }
}

const port = Number(process.env.PORT ?? DEFAULT_PORT);

const httpServer = createServer(async (req, res) => {
  if (!req.url) {
    res.writeHead(400).end("Missing URL");
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
    "Access-Control-Allow-Headers":
      "content-type, mcp-session-id, mcp-protocol-version, authorization",
    "Access-Control-Expose-Headers": "Mcp-Session-Id, mcp-session-id",
  };

  if (req.method === "OPTIONS" && url.pathname === MCP_PATH) {
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }

  if (req.method === "GET" && url.pathname === "/") {
    res
      .writeHead(200, { "content-type": "application/json" })
      .end(JSON.stringify({ name: "mcp-sidra", mcp: MCP_PATH }));
    return;
  }

  const mcpMethods = new Set(["POST", "GET", "DELETE"]);
  if (url.pathname === MCP_PATH && req.method && mcpMethods.has(req.method)) {
    for (const [header, value] of Object.entries(corsHeaders)) {
      res.setHeader(header, value);
    }

    const server = createSidraServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    res.on("close", () => {
      transport.close();
      server.close();
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res);
    } catch (error) {
      console.error("Error handling MCP request:", error);
      if (!res.headersSent) {
        res.writeHead(500).end("Internal server error");
      }
    }
    return;
  }

  res.writeHead(404).end("Not Found");
});

httpServer.listen(port, () => {
  console.log(`MCP SIDRA listening on http://localhost:${port}${MCP_PATH}`);
});
