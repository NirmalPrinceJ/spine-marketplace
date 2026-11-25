# SpineWorkspace Marketplace

Published catalog for the SpineWorkspace platform.

A listing in this repository is discoverable. It is not an installed connection, a running service, or a published host-marketplace package.

| Catalog | Path | Meaning |
|---|---|---|
| Internal | `marketplace/internal/marketplace.json` | Spine-owned services, agents, skills, and packages |
| External | `marketplace/external/marketplace.json` | Host connectors, business connectors, MCP servers, and plugins |
| Schema | `marketplace/schemas/package.schema.json` | Package shape |

Host distribution files under `distribution/` point at `https://mcp.spineworkspace.com/mcp`. They are catalog files. They have not been submitted to ChatGPT, Claude, Cursor, or Gemini marketplaces.

Source of truth for the running app remains the platform repository. This repository is the published catalog.
