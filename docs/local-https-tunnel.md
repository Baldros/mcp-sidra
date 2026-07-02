# Local HTTPS tunnel for MCP validation

This is the quick validation path before paying for a hosted provider. It runs
the MCP server on this machine, exposes it with a temporary HTTPS tunnel, and
uses that public URL in ChatGPT Developer Mode or another MCP client.

This is for development only. The `trycloudflare.com` URL changes when the
tunnel restarts and should not be treated as a production endpoint.

## Endpoint

- Local MCP URL: `http://127.0.0.1:8788/mcp`
- Public connector URL after tunneling: `https://<tunnel-host>/mcp`
- Local status/root check: `http://127.0.0.1:8788/`

## Prerequisites

- Node.js `>=22`
- Dependencies installed with `npm install`
- One HTTPS tunnel tool:
  - Cloudflare Tunnel: `cloudflared`
  - Or ngrok: `ngrok`

On Windows, Cloudflare Tunnel can be installed with:

```powershell
winget install --id Cloudflare.cloudflared --exact
```

If the command is not on `PATH`, the executable is commonly here:

```text
C:\Program Files (x86)\cloudflared\cloudflared.exe
```

## Option A: run in two terminals

Terminal 1, start the MCP server:

```powershell
cd E:\mcp-sidra
npm run dev
```

Confirm local HTTP is responding:

```powershell
Invoke-RestMethod http://127.0.0.1:8788/
```

Expected shape:

```json
{
  "name": "mcp-sidra",
  "mcp": "/mcp"
}
```

Terminal 2, start the HTTPS tunnel:

```powershell
cloudflared tunnel --url http://127.0.0.1:8788
```

If `cloudflared` is not on `PATH`:

```powershell
& "C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --url http://127.0.0.1:8788
```

Copy the generated URL, for example:

```text
https://example.trycloudflare.com
```

The MCP connector URL is:

```text
https://example.trycloudflare.com/mcp
```

Ngrok alternative, if Cloudflare Tunnel is unavailable:

```powershell
ngrok http 8788
```

Then use the HTTPS forwarding URL shown by ngrok:

```text
https://<ngrok-host>/mcp
```

## Option B: run in background on Windows

Start the MCP server:

```powershell
$repo = "E:\mcp-sidra"
$env:PORT = "8788"
Start-Process -FilePath "npm.cmd" `
  -ArgumentList "run","dev" `
  -WorkingDirectory $repo `
  -WindowStyle Hidden `
  -RedirectStandardOutput "$env:TEMP\mcp-sidra.out.log" `
  -RedirectStandardError "$env:TEMP\mcp-sidra.err.log" `
  -PassThru
```

Start the tunnel:

```powershell
$cloudflared = "C:\Program Files (x86)\cloudflared\cloudflared.exe"
Start-Process -FilePath $cloudflared `
  -ArgumentList "tunnel","--url","http://127.0.0.1:8788" `
  -WindowStyle Hidden `
  -RedirectStandardOutput "$env:TEMP\mcp-sidra-cloudflared.out.log" `
  -RedirectStandardError "$env:TEMP\mcp-sidra-cloudflared.err.log" `
  -PassThru
```

Read the tunnel URL from the log:

```powershell
Get-Content -Tail 80 "$env:TEMP\mcp-sidra-cloudflared.err.log" |
  Select-String "trycloudflare.com"
```

Stop the background processes by using the process IDs returned by
`Start-Process`:

```powershell
Stop-Process -Id <mcp-process-id>
Stop-Process -Id <cloudflared-process-id>
```

## Validate the public URL

Root check:

```powershell
Invoke-RestMethod https://<tunnel-host>/
```

MCP Inspector:

```powershell
npx @modelcontextprotocol/inspector@latest --server-url https://<tunnel-host>/mcp --transport http
```

## Use in ChatGPT Developer Mode

1. In ChatGPT, open Settings -> Apps & Connectors -> Advanced settings.
2. Enable Developer Mode if your organization allows it.
3. Create a connector/app from a remote MCP server.
   Current ChatGPT docs show this under Settings -> Connectors -> Create.
4. Enter connector metadata:
   - Connector name: `MCP SIDRA`
   - Description: `Consulta dados publicos do IBGE/SIDRA.`
   - Connector URL:

```text
https://<tunnel-host>/mcp
```

5. Use no auth for local validation unless this server has been changed to
   require auth.
6. After creating it, ChatGPT should show the tools advertised by the server.
   Start a new chat and add the connector from the tools list.

If the connector cannot be created, re-run the public root check and MCP
Inspector command above while the tunnel is still running.

The public URL must point to `/mcp`, not just the tunnel origin.

```text
https://<tunnel-host>/mcp
```

Official OpenAI reference:

```text
https://developers.openai.com/apps-sdk/deploy/connect-chatgpt
```

## Stop local processes

If you started the processes in foreground terminals, press `Ctrl+C` in each
terminal.

If you started them in the background, stop the process IDs returned by
`Start-Process`:

```powershell
Stop-Process -Id <mcp-process-id>
Stop-Process -Id <cloudflared-process-id>
```

If you lost the MCP server process ID, find the process listening on `8788`:

```powershell
Get-NetTCPConnection -LocalPort 8788 |
  Select-Object LocalAddress, LocalPort, State, OwningProcess
```

Then stop only that process:

```powershell
Stop-Process -Id <owning-process-id>
```

If you lost the Cloudflare Tunnel process ID, list `cloudflared` processes and
stop the one for this tunnel:

```powershell
Get-Process cloudflared | Select-Object Id, ProcessName, StartTime, Path
Stop-Process -Id <cloudflared-process-id>
```

## Later provider deployment

The tunnel proves that the server works over public HTTPS. For a stable public
URL, deploy the same server to Render, Railway, Fly.io, or a VPS/container host.

Provider requirements:

- Public HTTPS URL
- Long-running Node service
- `npm install`, `npm run build`, `npm start`
- `PORT` environment variable supplied by the provider
- Connector URL ending in `/mcp`
- `APP_DOMAIN` set to the final HTTPS origin when using the Apps SDK widget,
  for example `https://mcp-sidra.example.com`

For multiple MCPs later, prefer one provider account with separate services or
subdomains:

- `mcp-sidra` on its own service and `/mcp`
- `mcp-bacen` on its own service and `/mcp`
- `sinal-aberto` on its own service and `/mcp`

That keeps each MCP simple while still using one billing/provider account.
