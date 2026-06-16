# SIDRA API Guide

This document explains what SIDRA is, how the SIDRA data model works, which official IBGE endpoints are relevant, and how to build robust API calls for retrieving Brazilian statistical data programmatically.

## Table of contents

- [What is SIDRA?](#what-is-sidra)
- [Official documentation and source links](#official-documentation-and-source-links)
- [API families you should know](#api-families-you-should-know)
- [Authentication](#authentication)
- [Core data model](#core-data-model)
- [SIDRA legacy API: `/values`](#sidra-legacy-api-values)
- [Table descriptors](#table-descriptors)
- [IBGE Aggregates API v3](#ibge-aggregates-api-v3)
- [IBGE Localities API v1](#ibge-localities-api-v1)
- [Geographic levels and locality codes](#geographic-levels-and-locality-codes)
- [Periods](#periods)
- [Variables](#variables)
- [Classifications and categories](#classifications-and-categories)
- [Response format](#response-format)
- [Special value symbols](#special-value-symbols)
- [Examples](#examples)
- [Client implementation recommendations](#client-implementation-recommendations)
- [Troubleshooting](#troubleshooting)
- [Glossary](#glossary)

## What is SIDRA?

SIDRA stands for **Sistema IBGE de Recuperação Automática**. It is the IBGE system used to retrieve multidimensional statistical tables from Brazilian surveys, censuses, and administrative/statistical datasets.

The SIDRA web interface is available at:

- https://sidra.ibge.gov.br

The SIDRA API allows programs and web applications to extract data from the SIDRA database by constructing URLs that identify a table and select values across dimensions such as geography, period, variable, classification, and category.

In practical terms, SIDRA is useful when you need official IBGE statistical data such as:

- inflation indexes and price statistics;
- agricultural production;
- census indicators;
- population indicators;
- household survey indicators;
- economic, social, demographic, territorial, and sectoral statistics.

## Official documentation and source links

Primary sources:

- SIDRA API home: https://apisidra.ibge.gov.br/home
- SIDRA API help: https://apisidra.ibge.gov.br/home/ajuda
- SIDRA table descriptor endpoint: `https://apisidra.ibge.gov.br/DescritoresTabela/t/{table}`
- IBGE Aggregates API v3 docs: https://servicodados.ibge.gov.br/api/docs/agregados?versao=3
- IBGE Localities API v1 docs: https://servicodados.ibge.gov.br/api/docs/localidades
- IBGE general API documentation portal: https://servicodados.ibge.gov.br/api/docs

Use the official documentation as the source of truth. This guide is intended as a structured engineering reference for building a client or MCP server around SIDRA, not as a replacement for IBGE's official docs.

## API families you should know

There are three API surfaces that are especially relevant when building a complete SIDRA integration.

### 1. SIDRA API

Base URL:

```text
https://apisidra.ibge.gov.br
```

Most important endpoints:

```text
GET /values/{query-path}
GET /DescritoresTabela/t/{table}
```

The `/values` endpoint is the traditional SIDRA query interface. It returns actual data values.

The `/DescritoresTabela/t/{table}` endpoint returns the descriptor for a specific SIDRA table, including the metadata needed to discover variables, periods, territorial levels, classifications, and categories.

### 2. IBGE Aggregates API v3

Base URL:

```text
https://servicodados.ibge.gov.br/api/v3
```

Important endpoints:

```text
GET /agregados
GET /agregados/{aggregate}/metadados
GET /agregados/{aggregate}/periodos
GET /agregados/{aggregate}/localidades/{level}
GET /agregados/{aggregate}/periodos/{periods}/variaveis/{variable}
GET /agregados/{aggregate}/variaveis/{variable}
```

The Aggregates API is a newer standardized API. IBGE describes it as the API that feeds SIDRA, and each SIDRA table corresponds to an aggregate in this API.

### 3. IBGE Localities API v1

Base URL:

```text
https://servicodados.ibge.gov.br/api/v1/localidades
```

Important endpoints:

```text
GET /regioes
GET /estados
GET /municipios
GET /municipios/{id}
GET /estados/{UF}/municipios
GET /regioes/{macrorregiao}/estados
GET /mesorregioes
GET /microrregioes
GET /distritos
GET /subdistritos
```

Use this API to resolve official IBGE locality identifiers and administrative hierarchy metadata.

## Authentication

The public SIDRA and IBGE service-data APIs do **not** require an API key, token, OAuth flow, or login for ordinary public queries.

A typical request can be made directly with HTTP GET:

```bash
curl "https://apisidra.ibge.gov.br/values/t/1612/n1/1/v/allxp/p/2021/c81/2702/f/n/h/n"
```

## Core data model

SIDRA tables are multidimensional cubes. Each result value is identified by a combination of dimensions.

Core dimensions:

| Dimension | SIDRA parameter | Meaning |
|---|---:|---|
| Table | `t` | The SIDRA table identifier. Required. |
| Period | `p` | Year, month, quarter, semester, or other release period. |
| Variable | `v` | The measured quantity, index, rate, value, count, etc. |
| Territory | `n{level}` or `g` | Geographic level/locality or predefined territorial view. |
| Classification | `c{classification}` | A dimension such as sex, age group, product, activity, etc. |
| Category | value after `c{classification}` | Members of a classification. |

The official SIDRA help describes three basic dimensions present in every table: period, variable, and territorial unit. Tables may also have up to six classifications, for a maximum of nine dimensions in a query result.

## SIDRA legacy API: `/values`

### Endpoint

```text
GET https://apisidra.ibge.gov.br/values/{parameter-pairs}
```

The query is encoded in the path as pairs of parameter identifiers and values separated by `/`.

General shape:

```text
https://apisidra.ibge.gov.br/values/t/{table}/n{level}/{localities}/v/{variables}/p/{periods}/c{classification}/{categories}
```

Example:

```text
https://apisidra.ibge.gov.br/values/t/1612/n1/1/v/allxp/p/2021/c81/2702/f/n/h/n
```

### Required parameter

| Parameter | Required | Example | Description |
|---|---:|---|---|
| `t` | yes | `/t/1612` | Numeric SIDRA table code. |

### Common optional query dimensions

| Parameter | Example | Description |
|---|---|---|
| `p` | `/p/last`, `/p/2021`, `/p/2010-2022` | Period selection. Defaults to `/p/last` when omitted. |
| `v` | `/v/allxp`, `/v/214`, `/v/63,69` | Variable selection. Defaults to `/v/allxp` according to SIDRA help. |
| `n{level}` | `/n1/1`, `/n3/all`, `/n6/3550308` | Territorial level and locality selection. |
| `g` | `/g/44` | Predefined territorial view. Mutually exclusive with `n{level}` parameters. |
| `c{classification}` | `/c81/2702`, `/c2/all` | Classification and category selection. |

### Formatting parameters

| Parameter | Values | Description |
|---|---|---|
| `h` | `y`, `n` | Include or omit the header row. Default: `y`. |
| `f` | `a`, `c`, `n`, `u` | Field formatting. Default: `a`. |
| `d` | `s`, `m`, `0`-`9` | Decimal formatting. Default: `s`. |
| `u` | `y` | Include extinct territorial units where applicable. |

`f` values:

| Value | Meaning |
|---|---|
| `a` | Codes and names for descriptors. |
| `c` | Codes only. |
| `n` | Names only. |
| `u` | Codes and names for territorial units, names for other descriptors. |

`d` values:

| Value | Meaning |
|---|---|
| `s` | Standard decimal places for each variable. |
| `m` | Maximum available decimal precision. |
| `0`-`9` | Fixed number of decimal places. |

### Output format

By default, SIDRA returns JSON. You can request JSON or XML with a query string:

```text
?formato=json
?formato=xml
```

Examples:

```text
https://apisidra.ibge.gov.br/values/t/1612/n1/1/v/allxp/p/2021/c81/2702?formato=json
https://apisidra.ibge.gov.br/values/t/1612/n1/1/v/allxp/p/2021/c81/2702?formato=xml
```

You can also use the HTTP `Accept` header:

```text
Accept: application/json
Accept: application/xml
```

### Query size limit

The SIDRA API limits a query to **100,000 values**. To estimate the number of values, multiply the number of selected elements in each dimension:

```text
selected_periods * selected_variables * selected_localities * selected_categories_1 * ...
```

For large extracts, split requests by period, geography, classification, or variable.

## Table descriptors

Descriptor endpoint:

```text
GET https://apisidra.ibge.gov.br/DescritoresTabela/t/{table}
```

Example:

```text
https://apisidra.ibge.gov.br/DescritoresTabela/t/1612
```

Use this endpoint before building dynamic queries. A descriptor is the safest way to discover table-specific metadata such as:

- available periods;
- variables;
- geographic levels;
- territorial views;
- classifications;
- categories;
- default category for each classification;
- units of measure;
- valid combinations.

Recommended workflow:

1. Get the descriptor for a table.
2. Extract available dimensions.
3. Build a valid `/values` path from descriptor metadata.
4. Validate that the expected result size is below 100,000 values.
5. Request `/values`.
6. Normalize the response.

## IBGE Aggregates API v3

The Aggregates API is useful for both discovery and data retrieval. It is usually easier to explore programmatically than the legacy path-parameter SIDRA API.

Base URL:

```text
https://servicodados.ibge.gov.br/api/v3
```

### List aggregates

```text
GET /agregados
```

Full URL:

```text
https://servicodados.ibge.gov.br/api/v3/agregados
```

Optional filters documented by IBGE include:

- `periodo`
- `assunto`
- `classificacao`
- `periodicidade`
- `nivel`

### Get aggregate metadata

```text
GET /agregados/{aggregate}/metadados
```

Example:

```text
https://servicodados.ibge.gov.br/api/v3/agregados/1612/metadados
```

Use metadata to discover variables, classifications, categories, and available dimensions.

### Get periods for an aggregate

```text
GET /agregados/{aggregate}/periodos
```

Example:

```text
https://servicodados.ibge.gov.br/api/v3/agregados/1612/periodos
```

### Get localities for an aggregate and level

```text
GET /agregados/{aggregate}/localidades/{level}
```

Example:

```text
https://servicodados.ibge.gov.br/api/v3/agregados/1612/localidades/N1
```

### Get variable data by aggregate, periods, and variable

```text
GET /agregados/{aggregate}/periodos/{periods}/variaveis/{variable}
```

Important query parameters:

| Parameter | Description |
|---|---|
| `localidades` | Required locality selector. |
| `classificacao` | Optional classification/category selector. |
| `view` | Controls response verbosity/shape. |

Example shape:

```text
https://servicodados.ibge.gov.br/api/v3/agregados/1612/periodos/2021/variaveis/214?localidades=N1[1]&classificacao=81[2702]
```

### Get latest-six-period variable data shortcut

```text
GET /agregados/{aggregate}/variaveis/{variable}
```

IBGE documents this as functionally equivalent to querying the last six surveyed periods.

Example shape:

```text
https://servicodados.ibge.gov.br/api/v3/agregados/1612/variaveis/214?localidades=N1[1]&classificacao=81[2702]
```

## IBGE Localities API v1

The Localities API is the authoritative companion API for resolving Brazilian territorial identifiers.

Base URL:

```text
https://servicodados.ibge.gov.br/api/v1/localidades
```

Common endpoints:

```text
GET /regioes
GET /regioes/{macrorregiao}
GET /regioes/{macrorregiao}/estados

GET /estados
GET /estados/{UF}
GET /estados/{UF}/municipios
GET /estados/{UF}/distritos
GET /estados/{UF}/mesorregioes
GET /estados/{UF}/microrregioes

GET /municipios
GET /municipios/{municipio}

GET /mesorregioes
GET /mesorregioes/{mesorregiao}
GET /mesorregioes/{mesorregiao}/municipios
GET /mesorregioes/{mesorregiao}/microrregioes

GET /microrregioes
GET /microrregioes/{microrregiao}
GET /microrregioes/{microrregiao}/municipios

GET /distritos
GET /distritos/{id}

GET /subdistritos
GET /subdistritos/{id}
```

Examples:

```text
https://servicodados.ibge.gov.br/api/v1/localidades/estados
https://servicodados.ibge.gov.br/api/v1/localidades/estados/35/municipios
https://servicodados.ibge.gov.br/api/v1/localidades/municipios/3550308
```

## Geographic levels and locality codes

In SIDRA `/values` queries, territorial dimensions use `n{level}`.

Common SIDRA levels:

| Level | Meaning | Example selector |
|---:|---|---|
| `n1` | Brazil | `/n1/1` or `/n1/all` |
| `n2` | Major Region | `/n2/all` |
| `n3` | State / Federal Unit | `/n3/all`, `/n3/33,35` |
| `n6` | Municipality | `/n6/all`, `/n6/3304557,3550308` |

Common IBGE locality codes:

| Entity | Code | Notes |
|---|---:|---|
| Brazil | `1` | Used with `n1`. |
| Rio de Janeiro state | `33` | Used with `n3`. |
| São Paulo state | `35` | Used with `n3`. |
| Rio de Janeiro municipality | `3304557` | Used with `n6`. |
| São Paulo municipality | `3550308` | Used with `n6`. |

### Selecting all units at a level

```text
/n3/all
/n6/all
```

### Selecting specific units

```text
/n3/33,35
/n6/3304557,3550308
```

### Selecting units contained in a parent geography

SIDRA supports `in` selectors:

```text
/n6/in n3 35
```

Meaning: all municipalities (`n6`) inside state São Paulo (`n3` code `35`).

More examples:

```text
/n6/in n3 33,35
/n3/in n2 3,4
```

### Multiple geographic levels in one query

You can include more than one `n{level}` parameter when selecting different territorial levels:

```text
/t/1612/n1/1/n2/all/c81/2702/p/2012/v/214/f/n
```

When multiple levels are returned, SIDRA includes level metadata such as `NC` and `NN` in the response.

### `g` territorial views

The `g` parameter selects predefined territorial views:

```text
/g/44
```

`g` and `n{level}` are mutually exclusive in the same SIDRA query.

## Periods

SIDRA period codes depend on table periodicity.

### Annual tables

Annual tables use `YYYY`:

```text
/p/2021
/p/2010-2022
/p/2008,2010-2014
```

### Non-annual tables

For monthly, quarterly, semiannual, and similar tables, period codes generally use `YYYYSS`, where:

- `YYYY` is the year;
- `SS` is a sequence number based on the periodicity.

Examples:

```text
/p/201101-201112
/p/201204,201208
```

For monthly data, `SS` usually maps to `01` through `12`.

### Special period selectors

| Selector | Meaning |
|---|---|
| `/p/all` | All available periods. |
| `/p/first` | First available period. Equivalent to `/p/first 1`. |
| `/p/first 12` | First 12 available periods. |
| `/p/last` | Last available period. Equivalent to `/p/last 1`. |
| `/p/last 12` | Last 12 available periods. |

## Variables

Variables are measures: the numeric or symbolic values being reported.

Examples of variable meanings, depending on table:

- planted area;
- harvested area;
- produced quantity;
- production value;
- monthly variation;
- accumulated index;
- population;
- percentage;
- rate.

SIDRA selectors:

| Selector | Meaning |
|---|---|
| `/v/all` | All variables, including automatically generated percentage variables. |
| `/v/allxp` | All variables except automatically generated percentage variables. |
| `/v/214` | A single variable. |
| `/v/63,69` | Multiple variables. |

SIDRA's official help notes that variables with codes above `1,000,000` identify automatically calculated percentage variables. Availability of derived variables should be checked per table.

## Classifications and categories

Classifications are additional dimensions of a table. Categories are the members of a classification.

Examples:

| Classification type | Possible categories |
|---|---|
| Sex | Male, Female, Total |
| Age group | 0-4, 5-9, etc. |
| Product | Rice, beans, corn, etc. |
| Activity sector | Industry, services, agriculture, etc. |
| Household situation | Urban, rural, total |

In SIDRA path syntax:

```text
/c{classification}/{categories}
```

Example:

```text
/c81/2702
```

Meaning: classification `81`, category `2702`.

### Category selectors

| Selector | Meaning |
|---|---|
| `/c81/all` | All categories, including total. |
| `/c81/allxt` | All categories except total. |
| `/c81/2702` | One category. |
| `/c81/2692,2702` | Multiple categories. |
| `/c81/2694 2695` | Sum categories 2694 and 2695. |

### Default category behavior

If a classification is not specified, SIDRA uses the category that represents the total for that classification when such a category exists. If it does not exist, the query may return a symbol indicating that the value does not apply.

## Response format

SIDRA JSON responses are arrays of objects.

When `h/y` is used or omitted, the first object is a header row. When `h/n` is used, only value rows are returned.

Common fields:

| Field | Meaning |
|---|---|
| `V` | Value. May be numeric or a special symbol. |
| `MC` | Unit-of-measure code. |
| `MN` | Unit-of-measure name. |
| `NC` | Territorial level code, when applicable. |
| `NN` | Territorial level name, when applicable. |
| `D1C`, `D2C`, ... | Dimension codes, in the order dimensions appear in the query. |
| `D1N`, `D2N`, ... | Dimension names, in the order dimensions appear in the query. |

Important: the order of `D1`, `D2`, `D3`, etc. follows the order in which dimensions were specified in the URL. If you change the order of parameters in the path, the meaning of `D1N` or `D2N` can change.

Example:

```text
/t/1612/n1/1/c81/2702/p/2021/v/allxp/f/n/h/n
```

Because the dimensions appear in this order:

1. territorial unit;
2. category/classification;
3. period;
4. variable;

then the response dimension fields follow that order.

## Special value symbols

SIDRA values are not always numeric. Official data may include special symbols.

| Symbol | Meaning |
|---|---|
| `-` | Absolute zero, not resulting from rounding. |
| `0` | Zero resulting from calculation or rounding. |
| `X` | Inhibited value to avoid identifying the respondent/informant. |
| `..` | Value does not apply. |
| `...` | Value not available. |
| `A`-`Z`, except `X` | Value range indicator; interpretation varies by table. |

Client code must treat `V` as a string first, then parse numeric values only when safe.

## Examples

### Example 1: Fetch bean production data from table 1612

SIDRA URL:

```text
https://apisidra.ibge.gov.br/values/t/1612/n1/1/v/allxp/p/2021/c81/2702/f/n/h/n
```

Equivalent cURL:

```bash
curl "https://apisidra.ibge.gov.br/values/t/1612/n1/1/v/allxp/p/2021/c81/2702/f/n/h/n"
```

Python:

```python
import requests

url = "https://apisidra.ibge.gov.br/values/t/1612/n1/1/v/allxp/p/2021/c81/2702/f/n/h/n"
response = requests.get(url, timeout=30)
response.raise_for_status()
rows = response.json()

for row in rows[:5]:
    print(row)
```

### Example 2: Fetch latest available data

```text
https://apisidra.ibge.gov.br/values/t/1612/n1/1/v/allxp/p/last/c81/2702/f/n/h/n
```

### Example 3: Fetch several periods

```text
https://apisidra.ibge.gov.br/values/t/1612/n1/1/v/214/p/2019,2020,2021/c81/2702/f/n/h/n
```

### Example 4: Fetch a period range

```text
https://apisidra.ibge.gov.br/values/t/1612/n1/1/v/214/p/2010-2021/c81/2702/f/n/h/n
```

### Example 5: Fetch state-level data for all states

```text
https://apisidra.ibge.gov.br/values/t/1612/n3/all/v/214/p/2021/c81/2702/f/u/h/n
```

### Example 6: Fetch municipality-level data inside São Paulo state

```text
https://apisidra.ibge.gov.br/values/t/1612/n6/in%20n3%2035/v/214/p/2021/c81/2702/f/u/h/n
```

Some HTTP clients require spaces in URL paths to be encoded as `%20`.

### Example 7: Use the table descriptor

```bash
curl "https://apisidra.ibge.gov.br/DescritoresTabela/t/1612"
```

Python:

```python
import requests

url = "https://apisidra.ibge.gov.br/DescritoresTabela/t/1612"
descriptor = requests.get(url, timeout=30).json()
print(descriptor.keys())
```

### Example 8: Use Aggregates API metadata

```bash
curl "https://servicodados.ibge.gov.br/api/v3/agregados/1612/metadados"
```

Python:

```python
import requests

url = "https://servicodados.ibge.gov.br/api/v3/agregados/1612/metadados"
metadata = requests.get(url, timeout=30).json()
print(metadata)
```

### Example 9: Use Aggregates API for data retrieval

```text
https://servicodados.ibge.gov.br/api/v3/agregados/1612/periodos/2021/variaveis/214?localidades=N1[1]&classificacao=81[2702]
```

Python:

```python
import requests

url = "https://servicodados.ibge.gov.br/api/v3/agregados/1612/periodos/2021/variaveis/214"
params = {
    "localidades": "N1[1]",
    "classificacao": "81[2702]",
}
response = requests.get(url, params=params, timeout=30)
response.raise_for_status()
print(response.json())
```

### Example 10: Resolve locality codes

Get all states:

```bash
curl "https://servicodados.ibge.gov.br/api/v1/localidades/estados"
```

Get all municipalities in São Paulo state:

```bash
curl "https://servicodados.ibge.gov.br/api/v1/localidades/estados/35/municipios"
```

Python:

```python
import requests

url = "https://servicodados.ibge.gov.br/api/v1/localidades/estados/35/municipios"
municipalities = requests.get(url, timeout=30).json()

for municipality in municipalities[:10]:
    print(municipality["id"], municipality["nome"])
```

## Client implementation recommendations

### 1. Keep a clear separation between metadata and data calls

Recommended modules:

```text
sidra/
  client.py            # HTTP client and retry behavior
  descriptors.py       # SIDRA descriptor parsing
  aggregates.py        # Aggregates API wrapper
  localities.py        # Localities API wrapper
  query.py             # Query builder
  normalization.py     # Response normalization
```

### 2. Implement a query builder

A good SIDRA query builder should support:

- table code;
- periods;
- variables;
- territorial levels and localities;
- classifications and categories;
- formatting options;
- output format;
- validation against metadata when available.

Example interface:

```python
query = SidraQuery(table=1612)
query.level("n1", "1")
query.variables("allxp")
query.periods("2021")
query.classification(81, 2702)
query.format(fields="n", header=False)

url = query.to_url()
```

Expected output:

```text
https://apisidra.ibge.gov.br/values/t/1612/n1/1/v/allxp/p/2021/c81/2702/f/n/h/n
```

### 3. Validate result size before calling `/values`

Because the official limit is 100,000 values, estimate result size before issuing a request.

Pseudo-code:

```python
def estimate_result_size(dimensions: list[list[str]]) -> int:
    size = 1
    for dimension in dimensions:
        size *= len(dimension)
    return size
```

If the result is too large, split requests:

- one period at a time;
- one state at a time;
- one variable at a time;
- one classification category batch at a time.

### 4. Treat all values as strings until parsed

Do not assume `V` is numeric. Handle special symbols first.

```python
SPECIAL_VALUES = {"-", "X", "..", "..."}

def parse_sidra_value(value: str):
    if value in SPECIAL_VALUES:
        return None
    try:
        return float(value.replace(",", "."))
    except ValueError:
        return value
```

### 5. Preserve dimension metadata

Do not drop `D1C`, `D1N`, `D2C`, `D2N`, etc. too early. Their meaning depends on query order.

A robust normalizer should either:

- keep raw `D*` fields; or
- map them to semantic names using the request dimension order.

### 6. Prefer descriptors or Aggregates metadata for discovery

Avoid hardcoding variables, classifications, and categories except for known examples or tests. Use:

```text
https://apisidra.ibge.gov.br/DescritoresTabela/t/{table}
https://servicodados.ibge.gov.br/api/v3/agregados/{aggregate}/metadados
```

### 7. Use Localities API for geography lookup

Avoid maintaining your own static locality table unless you need offline operation. Resolve IDs through:

```text
https://servicodados.ibge.gov.br/api/v1/localidades
```

### 8. Be explicit about hostnames

Use:

```text
https://apisidra.ibge.gov.br
```

instead of the older-looking singular host:

```text
https://api.sidra.ibge.gov.br
```

Some environments may report TLS hostname mismatch errors when using the singular `api.sidra.ibge.gov.br` host. The official SIDRA API documentation currently uses `apisidra.ibge.gov.br`.

## Troubleshooting

### `SSLCertVerificationError` or hostname mismatch

Symptom:

```text
certificate verify failed: Hostname mismatch, certificate is not valid for 'api.sidra.ibge.gov.br'
```

Recommended fix:

Use the official host:

```text
https://apisidra.ibge.gov.br
```

not:

```text
https://api.sidra.ibge.gov.br
```

Also update local certificate packages when needed:

```bash
python -m pip install --upgrade requests certifi
```

### Empty or special-symbol values

Check whether the returned value is one of:

```text
-
X
..
...
```

These are official statistical symbols and should not be blindly parsed as numbers.

### Unexpected `D1N`, `D2N`, etc.

Remember: response dimension order follows request parameter order. Keep query order stable or normalize fields using the same order used to build the URL.

### Query too large

If a query exceeds SIDRA's 100,000-value limit, split it by period, geography, variable, or category.

### Invalid classification or category

Classifications and categories are table-specific. Always check the descriptor or aggregate metadata for the table before constructing queries dynamically.

## Glossary

| Term | Meaning |
|---|---|
| SIDRA | IBGE's automatic retrieval system for statistical tables. |
| Table | A SIDRA multidimensional table. In Aggregates API terms, an aggregate. |
| Aggregate | Standardized IBGE API representation corresponding to a SIDRA table. |
| Variable | A measure, such as quantity, rate, value, index, or percentage. |
| Period | Time reference of the data. |
| Territorial unit | A geographic unit such as Brazil, region, state, or municipality. |
| Territorial level | The type of geography, such as `n1`, `n2`, `n3`, or `n6`. |
| Classification | Extra dimension such as sex, age group, product, or activity. |
| Category | A member of a classification. |
| Descriptor | Metadata describing the dimensions and options available for a SIDRA table. |

## Minimal checklist for accessing any SIDRA information

1. Identify the SIDRA table / aggregate code.
2. Fetch the descriptor or aggregate metadata.
3. Choose periods.
4. Choose variables.
5. Choose geographic level and locality codes.
6. Choose classifications and categories.
7. Estimate result size and split if needed.
8. Build the `/values` or Aggregates API URL.
9. Request data.
10. Normalize response rows, preserving metadata and special symbols.

## References

- SIDRA API home: https://apisidra.ibge.gov.br/home
- SIDRA API help: https://apisidra.ibge.gov.br/home/ajuda
- SIDRA table descriptor endpoint: https://apisidra.ibge.gov.br/DescritoresTabela/t/{table}
- IBGE Aggregates API v3: https://servicodados.ibge.gov.br/api/docs/agregados?versao=3
- IBGE Localities API v1: https://servicodados.ibge.gov.br/api/docs/localidades
