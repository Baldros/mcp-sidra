# MCP SIDRA

Servidor MCP remoto para dados públicos do IBGE/SIDRA, estruturado para virar um app do ChatGPT com Apps SDK.

## Stack

- Node.js + TypeScript + ESM
- `@modelcontextprotocol/sdk` com transporte Streamable HTTP em `/mcp`
- `@modelcontextprotocol/ext-apps` para recursos UI do Apps SDK
- Zod para schemas de entrada e saída
- Vitest para testes do query builder e normalização

## Ferramentas MCP

- `search` e `fetch`: compatíveis com o padrão data-only/company knowledge do ChatGPT.
- `describe_table`: busca metadados de uma tabela/agregado SIDRA.
- `get_sidra_values`: consulta o endpoint legado `/values`.
- `get_aggregate_data`: consulta a API de Agregados v3.
- `list_localities`: resolve regiões, estados, municípios e municípios por UF.

Todas as ferramentas são read-only.

## Desenvolvimento

```bash
npm install
npm run dev
```

O MCP fica disponível em:

```text
http://localhost:8787/mcp
```

Teste com o MCP Inspector:

```bash
npm run inspect
```

## ChatGPT App

Para conectar no ChatGPT durante desenvolvimento:

1. Rode `npm run dev`.
2. Exponha a porta com um túnel HTTPS, por exemplo `ngrok http 8787`.
3. Em ChatGPT, ative developer mode e crie um app/conector apontando para `https://<subdomain>.ngrok.app/mcp`.

Para submissão, defina `APP_DOMAIN` com o domínio HTTPS final do app. O widget é opcional, mas já existe um recurso Apps SDK simples para renderizar resultados tabulares.

## Exemplos de prompts

```text
Descreva a tabela SIDRA 1612.
```

```text
Busque a quantidade produzida de feijão no Brasil em 2021 pela tabela 1612.
```

```text
Liste os municípios do estado de São Paulo pelo IBGE.
```
