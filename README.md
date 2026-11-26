# SpineWorkspace Marketplace

Published catalog for the SpineWorkspace platform.

A listing in this repository is published for discovery. It is not an installed connection, a running service, or a package submitted to a host marketplace.

| Catalog | Path | Published | Connected |
|---|---|---|---|
| External | `marketplace/external/marketplace.json` | Yes. Hosts, core connectors, Composio, MCP registry. | No |
| Internal | `marketplace/internal/marketplace.json` | Yes. Spine services, MCP, Twin, agents. | No |
| Schema | `marketplace/schemas/package.schema.json` | Package shape | — |

Host files under `distribution/` are published in this catalog and point at `https://mcp.spineworkspace.com/mcp`. `hostMarketplaceSubmitted` is false. They have not been submitted to ChatGPT, Claude, Cursor, Gemini, or Grok stores.

Google Drive and Google Calendar are the only core connectors marked `liveRead`. That is a read path, not a connection.
