# SpineWorkspace Marketplace

Published catalog for the SpineWorkspace platform.

A listing in this repository is published for discovery. It is not an installed connection, a running service, or a package submitted to a host marketplace.

| Catalog | Path | Published | Connected |
|---|---|---|---|
| External | `marketplace/external/marketplace.json` | Yes. 75 packages: hosts, core connectors, Composio, MCP registry, project infrastructure, domain connectors. | No |
| Internal | `marketplace/internal/marketplace.json` | Yes. 65 packages: Spine services, MCP, Twin, agents, skills, workflows, knowledge packages, capabilities, Workbench packages. | No |
| Schema | `marketplace/schemas/package.schema.json` | Package shape | — |

## Shelves

| Catalog | Shelf or category | Count | Detail file |
|---|---|---|---|
| External | Host connectors | 9 | `external/ai-host.json` (partial) |
| External | Core connectors | 24 | — |
| External | Composio | 15 | — |
| External | MCP registry | 11 | — |
| External | Project infrastructure | 11 | `external/project-infrastructure.json` |
| External | Domain connectors | 5 | `external/domain.json` |
| Internal | Host packages | 2 | — |
| Internal | Core services | 4 | `internal/core-services.json` |
| Internal | MCP | 2 | `internal/mcp.json` |
| Internal | Intelligence | 1 | — |
| Internal | Agents | 6 | `internal/agents.json` |
| Internal | Skills | 4 | `internal/skills.json` |
| Internal | Workflows | 3 | `internal/workflows.json` |
| Internal | Knowledge packages | 2 | `internal/knowledge.json` |
| Internal | Capabilities | 29 | `internal/capabilities.json` |
| Internal | Workbench packages | 12 | `internal/workbench.json` |

The 29 capabilities are the names of the 29 Spine Tools in the public MCP contract. A listed capability is a name, not an authorized live operation. No project-infrastructure or domain connector has an adapter wired. A Workbench package is not a deployed application.

Host files under `distribution/` are published in this catalog and point at `https://mcp.spineworkspace.com/mcp`. `hostMarketplaceSubmitted` is false. They have not been submitted to ChatGPT, Claude, Cursor, Gemini, or Grok stores.

Google Drive and Google Calendar are the only core connectors marked `liveRead`. That is a read path, not a connection.
